"""
generate_news.py — fetches RSS feeds, calls Groq API (free) to produce
the 10-section news desk. Writes result to temp_news.txt.

Env vars required:
    GROQ_API_KEY  — from console.groq.com (free, no credit card)
"""
import os
import re
import sys
from datetime import datetime
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
MAX_ARTICLES     = 6
MAX_CONTENT_CHARS = 30000

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


# ── RSS fetcher ────────────────────────────────────────────────────────────

def fetch_rss() -> list[str]:
    articles = []
    for name, url in RSS_SOURCES:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:MAX_ARTICLES]:
                title   = entry.get("title", "").strip()
                summary = entry.get("summary", entry.get("description", ""))
                summary = re.sub(r"<[^>]+>", "", summary).strip()[:600]
                articles.append(f"[{name}] {title}\n{summary}")
        except Exception as e:
            print(f"[RSS_WARN] {name}: {e}")
    return articles


# ── LLM API call (Gemini primary, Groq fallback) ───────────────────────────

MAX_RETRIES = 3


def _call_gemini(api_key: str, system_prompt: str, user_content: str) -> tuple[bool, str]:
    """Native Gemini API — more reliable than OpenAI-compat wrapper."""
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    resp = requests.post(
        url,
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        json={
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_content}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 6000},
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

    print("[STEP_1] Fetching RSS feeds...")
    articles = fetch_rss()
    print(f"[STEP_1_COMPLETE] {len(articles)} articles fetched")

    news_context = "\n\n---\n\n".join(articles)
    if len(news_context) > MAX_CONTENT_CHARS:
        news_context = news_context[:MAX_CONTENT_CHARS]

    user_content = f"חדשות עדכניות שנאספו עכשיו:\n\n{news_context}"

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
