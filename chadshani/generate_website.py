"""
generate_website.py — reads temp_news.txt, builds website/index.html,
pushes to GitHub Pages, sends Telegram notification.
"""
import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

# ── Minimal .env loader ────────────────────────────────────────────────────

ROOT     = Path(__file__).parent
ENV_FILE = ROOT / ".env"
TZ_IL    = ZoneInfo("Asia/Jerusalem")


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


load_env(ENV_FILE)

# ── CONFIG ──────────────────────────────────────────────────────────────────

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")
GITHUB_USER        = os.environ.get("GITHUB_USER", "YOUR_GITHUB_USER")
GITHUB_REPO        = os.environ.get("GITHUB_REPO", "chadshani")

# ──────────────────────────────────────────────────────────────────────────

TEMP_NEWS   = ROOT / "temp_news.txt"
OUTPUT_HTML = ROOT / "website" / "index.html"
PAGES_URL   = f"https://{GITHUB_USER}.github.io/{GITHUB_REPO}"

SECTION_PATTERN = re.compile(r"^##\s+(\d+)\.\s+(.+)$", re.MULTILINE)
TS_PATTERN      = re.compile(r"(\d{2}\.\d{2}\.\d{4}\s*\|\s*\d{2}:\d{2})")

# Fear & Greed extraction (looks for "CNN: 42" or "42/100" or standalone number near keyword)
FNG_PATTERN     = re.compile(
    r"(?:CNN[^:]*:|Fear\s*&\s*Greed[^:]*:)\s*(\d{1,3})",
    re.IGNORECASE,
)
CRYPTO_FNG_PATTERN = re.compile(
    r"(?:Crypto[^:]*:|קריפטו[^:]*:)\s*(\d{1,3})",
    re.IGNORECASE,
)
VIX_PATTERN = re.compile(r"VIX[^:]*:\s*([\d.]+)", re.IGNORECASE)


# ── Parsers ────────────────────────────────────────────────────────────────

def extract_timestamp(text: str) -> str:
    m = TS_PATTERN.search(text)
    return m.group(1).strip() if m else datetime.now(TZ_IL).strftime("%d.%m.%Y %H:%M")


def parse_sections(text: str) -> list[dict]:
    """
    Returns list of dicts: {num, title, content}
    Sections 0–9 map to the 10-section news desk format.
    """
    matches = list(SECTION_PATTERN.finditer(text))
    sections = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        sections.append({
            "num":     int(m.group(1)),
            "title":   m.group(2).strip(),
            "content": content,
        })
    return sections


def extract_gauge_values(section0_content: str) -> dict:
    """Extract numeric Fear & Greed + VIX values from section 0 text."""
    values = {"fng": None, "crypto_fng": None, "vix": None}
    m = FNG_PATTERN.search(section0_content)
    if m:
        values["fng"] = int(m.group(1))
    m2 = CRYPTO_FNG_PATTERN.search(section0_content)
    if m2:
        values["crypto_fng"] = int(m2.group(1))
    m3 = VIX_PATTERN.search(section0_content)
    if m3:
        try:
            values["vix"] = float(m3.group(1))
        except ValueError:
            pass
    return values


# ── HTML builder ───────────────────────────────────────────────────────────

def build_html(sections: list[dict], timestamp: str, gauges: dict) -> str:
    sections_json = json.dumps(sections, ensure_ascii=False, indent=2)
    gauges_json   = json.dumps(gauges, ensure_ascii=False)

    template = OUTPUT_HTML.read_text(encoding="utf-8")
    html = template.replace("PLACEHOLDER_NEWS_JSON", sections_json)
    html = html.replace("PLACEHOLDER_DATETIME", timestamp)
    html = html.replace("PLACEHOLDER_GAUGES_JSON", gauges_json)
    return html


# ── Git push ───────────────────────────────────────────────────────────────

def git_push(commit_msg: str) -> bool:
    cmds = [
        ["git", "-C", str(ROOT), "add", "website/index.html"],
        ["git", "-C", str(ROOT), "commit", "-m", commit_msg],
        ["git", "-C", str(ROOT), "push"],
    ]
    for cmd in cmds:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[GIT_ERROR] {' '.join(cmd)}\n{result.stderr}")
            return False
    return True


# ── Telegram ───────────────────────────────────────────────────────────────

def send_telegram(message: str) -> None:
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": message},
            timeout=10,
        )
        print(f"[TELEGRAM_STATUS] {resp.status_code} {resp.text[:300]}")
    except Exception as e:
        print(f"[TELEGRAM_WARN] {e}")


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    if not TEMP_NEWS.exists():
        print("[ERROR] temp_news.txt not found")
        return

    text = TEMP_NEWS.read_text(encoding="utf-8")
    if not text.strip():
        print("[ERROR] temp_news.txt is empty")
        return

    timestamp = extract_timestamp(text)
    now_il    = datetime.now(TZ_IL)

    print("[STEP_1] Parsing sections...")
    sections = parse_sections(text)
    print(f"[STEP_1_COMPLETE] {len(sections)} sections parsed")

    # Extract gauge values from section 0 (if present)
    gauges = {}
    sec0 = next((s for s in sections if s["num"] == 0), None)
    if sec0:
        gauges = extract_gauge_values(sec0["content"])
        print(f"[GAUGES] {gauges}")

    print("[STEP_2] Building HTML...")
    html = build_html(sections, timestamp, gauges)
    OUTPUT_HTML.write_text(html, encoding="utf-8")
    print("[STEP_2_COMPLETE]")

    print("[STEP_3] Pushing to GitHub Pages...")
    skip_push = os.environ.get("SKIP_GIT_PUSH", "").lower() in ("true", "1", "yes")
    if skip_push:
        print("[STEP_3_SKIP] SKIP_GIT_PUSH set — GitHub Actions will handle push")
        ok = True
    else:
        commit_msg = f"update {now_il.strftime('%Y-%m-%d %H:%M')}"
        ok = git_push(commit_msg)
        if ok:
            print("[STEP_3_COMPLETE]")
        else:
            print("[STEP_3_WARN] Git push failed — sending local path")

    print("[STEP_4] Sending Telegram...")
    date_str = now_il.strftime("%d.%m.%Y")
    time_str = now_il.strftime("%H:%M")
    url = PAGES_URL if ok else str(OUTPUT_HTML)
    msg = f"עדכון החדשות מוכן נכון ל{date_str} {time_str}\n{url}"
    send_telegram(msg)
    print("[STEP_4_COMPLETE]")

    TEMP_NEWS.unlink(missing_ok=True)
    print("[PIPELINE_COMPLETE]")


if __name__ == "__main__":
    main()
