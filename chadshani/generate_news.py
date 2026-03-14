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

import feedparser
import requests

ROOT        = Path(__file__).parent
ENV_FILE    = ROOT / ".env"
PROMPT_FILE = ROOT / "chadshani_prompt.txt"
TEMP_NEWS   = ROOT / "temp_news.txt"
TZ_IL       = ZoneInfo("Asia/Jerusalem")
MIN_LENGTH  = 500
MAX_ARTICLES     = 6
MAX_CONTENT_CHARS = 55000

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


# ── Groq API call ──────────────────────────────────────────────────────────

def call_groq(system_prompt: str, user_content: str) -> tuple[bool, str]:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        msg = "[ERROR] GROQ_API_KEY not set — add it to GitHub Secrets or .env"
        print(msg, file=sys.stderr)
        return False, msg

    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  "application/json",
            },
            json={
                "model":       "llama-3.3-70b-versatile",
                "messages":    [
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_content},
                ],
                "temperature": 0.3,
                "max_tokens":  8000,
            },
            timeout=120,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]

        if len(text) < MIN_LENGTH:
            msg = f"[ERROR] Groq output too short ({len(text)} chars)"
            print(msg, file=sys.stderr)
            return False, msg

        return True, text

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

    print("[STEP_2] Calling Groq API (llama-3.3-70b)...")
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
