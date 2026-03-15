"""
generate_news.py — fetches RSS feeds, calls Groq API (free) to produce
the 10-section news desk. Writes result to temp_news.txt.

Env vars required:
    GROQ_API_KEY  — from console.groq.com (free, no credit card)
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import time

import feedparser
import requests

ROOT        = Path(__file__).parent
ENV_FILE    = ROOT / ".env"
PROMPT_FILE = ROOT / "chadshani_prompt.txt"
TEMP_NEWS   = ROOT / "temp_news.txt"
TZ_IL       = ZoneInfo("Asia/Jerusalem")
MIN_LENGTH  = 500
MAX_ARTICLES      = 6
MAX_CONTENT_CHARS = 40000   # Gemini handles large context; Groq fallback truncates internally

RSS_SOURCES = [
    ("Reuters Business",  "https://feeds.reuters.com/reuters/businessNews"),
    ("Reuters Tech",      "https://feeds.reuters.com/reuters/technologyNews"),
    ("CoinDesk",          "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("CoinTelegraph",     "https://cointelegraph.com/rss"),
    ("TechCrunch",        "https://techcrunch.com/feed/"),
    ("VentureBeat AI",    "https://venturebeat.com/ai/feed/"),
    ("Ars Technica",      "https://feeds.arstechnica.com/arstechnica/index"),
    ("The Verge",         "https://www.theverge.com/rss/index.xml"),
    ("Seeking Alpha",     "https://seekingalpha.com/market_currents.xml"),
    ("Decrypt Crypto",    "https://decrypt.co/feed"),
]


# ── Minimal .env loader ────────────────────────────────────────────────────

def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


# ── Timestamp ──────────────────────────────────────────────────────────────

def get_timestamp() -> str:
    return datetime.now(TZ_IL).strftime("%d.%m.%Y | %H:%M | שעון ישראל")


def ensure_timestamp(text: str) -> str:
    if re.match(r"\d{2}\.\d{2}\.\d{4}", text.strip()[:20]):
        return text
    return f"{get_timestamp()}\n\n{text}"


# ── Live market data (free, no API key) ────────────────────────────────────

def fetch_market_data() -> str:
    """Fetch real F&G, Crypto F&G and VIX. Saves gauges_live.json + returns formatted string."""
    lines = []
    gauges: dict = {"fng": None, "crypto_fng": None, "vix": None}

    # CNN Fear & Greed
    try:
        r = requests.get(
            "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        d = r.json()["fear_and_greed"]
        val  = round(d["score"])
        prev = round(d.get("previous_close", d["score"]))
        rating = d.get("rating", "")
        gauges["fng"] = val
        lines.append(f"CNN Fear & Greed Index: {val}/100 ({rating}) | שבוע שעבר: {prev}")
    except Exception as e:
        lines.append(f"CNN Fear & Greed Index: לא זמין ({e})")

    # Crypto Fear & Greed
    try:
        r = requests.get("https://api.alternative.me/fng/?limit=1", timeout=10)
        d = r.json()["data"][0]
        gauges["crypto_fng"] = int(d["value"])
        lines.append(f"Crypto Fear & Greed Index: {d['value']}/100 ({d['value_classification']})")
    except Exception as e:
        lines.append(f"Crypto Fear & Greed Index: לא זמין ({e})")

    # VIX via Yahoo Finance
    try:
        r = requests.get(
            "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX",
            params={"interval": "1d", "range": "1d"},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        meta = r.json()["chart"]["result"][0]["meta"]
        vix  = meta.get("regularMarketPrice") or meta.get("previousClose")
        gauges["vix"] = float(vix) if vix is not None else None
        lines.append(f"VIX (מדד הפחד): {vix}")
    except Exception as e:
        lines.append(f"VIX: לא זמין ({e})")

    # Save raw gauge values directly (bypasses LLM text parsing)
    data_dir = ROOT / "data"
    data_dir.mkdir(exist_ok=True)
    (data_dir / "gauges_live.json").write_text(
        json.dumps(gauges, ensure_ascii=False), encoding="utf-8"
    )
    print(f"[GAUGES_LIVE] saved: {gauges}")

    result = "\n".join(lines)
    print(f"[MARKET_DATA]\n{result}")
    return result


# ── RSS fetcher ────────────────────────────────────────────────────────────

ARTICLE_MAX_AGE_HOURS = 48


def is_recent(entry) -> bool:
    """True if article published within last 48 hours (or no date available)."""
    for field in ('published_parsed', 'updated_parsed'):
        t = entry.get(field)
        if t:
            try:
                dt    = datetime(*t[:6], tzinfo=timezone.utc)
                age_h = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
                return age_h <= ARTICLE_MAX_AGE_HOURS
            except Exception:
                pass
    return True  # אין תאריך — כלול (benefit of doubt)


def fetch_rss() -> list[str]:
    articles = []
    for name, url in RSS_SOURCES:
        try:
            feed = feedparser.parse(url)
            source_articles = []
            for entry in feed.entries[:MAX_ARTICLES * 3]:
                if not is_recent(entry):
                    continue
                title   = entry.get("title", "").strip()
                summary = entry.get("summary", entry.get("description", ""))
                summary = re.sub(r"<[^>]+>", "", summary).strip()[:600]
                source_articles.append(f"[{name}] {title}\n{summary}")
                if len(source_articles) >= MAX_ARTICLES:
                    break
            articles.extend(source_articles)
        except Exception as e:
            print(f"[RSS_WARN] {name}: {e}")
    return articles


# ── LLM API call (Gemini primary, Groq fallback) ───────────────────────────

MAX_RETRIES = 3


def _call_gemini(api_key: str, system_prompt: str, user_content: str) -> tuple[bool, str]:
    """Native Gemini API — more reliable than OpenAI-compat wrapper."""
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
    resp = requests.post(
        url,
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        json={
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_content}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 8192},
        },
        timeout=120,
    )
    if resp.status_code == 429:
        wait = int(resp.headers.get("retry-after", 60))
        print(f"[WARN] Gemini 429, waiting {wait}s")
        time.sleep(wait)
        return False, "429"
    resp.raise_for_status()
    text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    return True, text


def _call_groq(api_key: str, system_prompt: str, user_content: str) -> tuple[bool, str]:
    user_content = user_content[:6000]  # Groq free tier payload limit
    for model in ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]:
        for attempt in range(MAX_RETRIES):
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_content},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4000,
                },
                timeout=120,
            )
            if resp.status_code == 429:
                wait = int(resp.headers.get("retry-after", 60))
                print(f"[WARN] Groq 429 on {model}, waiting {wait}s ({attempt+1}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return True, resp.json()["choices"][0]["message"]["content"]
    return False, "[ERROR] Groq retries exhausted"


def call_groq(system_prompt: str, user_content: str) -> tuple[bool, str]:
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            ok, text = _call_gemini(gemini_key, system_prompt, user_content)
            if ok and len(text) >= MIN_LENGTH:
                print("[INFO] Provider: Gemini / gemini-2.0-flash")
                return True, text
            if not ok and text != "429":
                print(f"[WARN] Gemini failed, falling back to Groq")
        except Exception as e:
            print(f"[WARN] Gemini error: {e}, falling back to Groq")
    else:
        print("[INFO] GEMINI_API_KEY not set, using Groq")

    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        msg = "[ERROR] No API keys available (GEMINI_API_KEY or GROQ_API_KEY required)"
        print(msg, file=sys.stderr)
        return False, msg

    try:
        ok, text = _call_groq(groq_key, system_prompt, user_content)
        if ok and len(text) >= MIN_LENGTH:
            print("[INFO] Provider: Groq / llama")
            return True, text
        print(text, file=sys.stderr)
        return False, text
    except Exception as e:
        msg = f"[ERROR] Groq API error: {e}"
        print(msg, file=sys.stderr)
        return False, msg


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> int:
    load_env(ENV_FILE)

    if not PROMPT_FILE.exists():
        print(f"[ERROR] Prompt file not found: {PROMPT_FILE}", file=sys.stderr)
        return 1

    base_prompt = PROMPT_FILE.read_text(encoding="utf-8")

    print("[STEP_1] Fetching live market data...")
    market_data = fetch_market_data()
    print("[STEP_1] Fetching RSS feeds...")
    articles = fetch_rss()
    print(f"[STEP_1_COMPLETE] {len(articles)} articles fetched")

    news_context = "\n\n---\n\n".join(articles)
    if len(news_context) > MAX_CONTENT_CHARS:
        news_context = news_context[:MAX_CONTENT_CHARS]

    user_content = (
        f"נתוני שוק בזמן אמת (חובה להשתמש בערכים המדויקים האלה — אל תמציא):\n{market_data}"
        f"\n\n---\n\nחדשות עדכניות שנאספו עכשיו:\n\n{news_context}"
    )

    print("[STEP_2] Calling LLM API (Gemini → Groq fallback)...")
    ok, output = call_groq(base_prompt, user_content)

    if not ok:
        TEMP_NEWS.write_text(output, encoding="utf-8")
        return 1

    output = ensure_timestamp(output)
    TEMP_NEWS.write_text(output, encoding="utf-8")
    print(f"[STEP_2_COMPLETE] {len(output)} chars, {len(output.splitlines())} lines")
    return 0


if __name__ == "__main__":
    sys.exit(main())
