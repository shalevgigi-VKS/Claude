"""
setup_cloudflare.py — הגדרה אוטומטית חד-פעמית של Cloudflare Worker + Telegram Webhook

מה הסקריפט עושה (ללא curl ידני):
  1. קורא .env מה-root של הפרויקט
  2. מעלה את worker.js ל-Cloudflare Workers דרך REST API
  3. מגדיר secrets (GITHUB_PAT, REPO_OWNER, REPO_NAME, TELEGRAM_SECRET) ב-Worker
  4. מגדיר setWebhook בטלגרם עם ה-Worker URL

משתנים נדרשים ב-.env:
  CLOUDFLARE_API_TOKEN  — dashboard.cloudflare.com → My Profile → API Tokens
                           (צור Token עם permission: Workers Scripts:Edit)
  CLOUDFLARE_ACCOUNT_ID — dashboard.cloudflare.com → Home → Account ID (ימין)
  TELEGRAM_BOT_TOKEN    — מ-BotFather
  GITHUB_PAT            — github.com → Settings → Developer settings → PAT (scope: workflow)
  REPO_OWNER            — שם המשתמש ב-GitHub (ברירת מחדל: shalevgigi-VKS)
  REPO_NAME             — שם הריפו (ברירת מחדל: Claude)
  TELEGRAM_SECRET       — מחרוזת סודית לאימות (ייוצר אוטומטית אם לא מוגדר)

הרצה:
  python chadshani/cloudflare-worker/setup_cloudflare.py
"""
import os
import sys
import secrets
from pathlib import Path

import requests

SCRIPT_DIR = Path(__file__).parent
ROOT       = SCRIPT_DIR.parent.parent   # e:\Claude
ENV_FILE   = ROOT / "chadshani" / ".env"
WORKER_JS  = SCRIPT_DIR / "worker.js"
WORKER_NAME = "chadshani-trigger"

CF_API_BASE = "https://api.cloudflare.com/client/v4"


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


def require(key: str, hint: str = "") -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        print(f"[ERROR] Missing env var: {key}")
        if hint:
            print(f"  → {hint}")
        sys.exit(1)
    return val


def cf_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    }


# ── 1. Upload Worker script ────────────────────────────────────────────────

def upload_worker(token: str, account_id: str, js_code: str) -> str:
    """PUT the worker script. Returns worker URL subdomain."""
    url = f"{CF_API_BASE}/accounts/{account_id}/workers/scripts/{WORKER_NAME}"
    # Cloudflare Workers upload requires multipart/form-data
    files = {
        "metadata": (None, '{"main_module":"worker.js"}', "application/json"),
        "worker.js": ("worker.js", js_code, "application/javascript+module"),
    }
    resp = requests.put(
        url,
        headers={"Authorization": f"Bearer {token}"},
        files=files,
        timeout=30,
    )
    data = resp.json()
    if not data.get("success"):
        # Fallback: try non-module upload (older accounts)
        files2 = {
            "script": ("worker.js", js_code, "application/javascript"),
        }
        resp2 = requests.put(
            url,
            headers={"Authorization": f"Bearer {token}"},
            files=files2,
            timeout=30,
        )
        data2 = resp2.json()
        if not data2.get("success"):
            print(f"[ERROR] Worker upload failed: {data2.get('errors')}")
            sys.exit(1)
        print("[OK] Worker script uploaded (legacy format)")
    else:
        print("[OK] Worker script uploaded")

    # Get subdomain for worker URL
    subdomain_resp = requests.get(
        f"{CF_API_BASE}/accounts/{account_id}/workers/subdomain",
        headers=cf_headers(token),
        timeout=10,
    )
    subdomain_data = subdomain_resp.json()
    subdomain = subdomain_data.get("result", {}).get("subdomain", "")
    if subdomain:
        worker_url = f"https://{WORKER_NAME}.{subdomain}.workers.dev"
    else:
        worker_url = f"https://{WORKER_NAME}.workers.dev"
    print(f"[INFO] Worker URL: {worker_url}")
    return worker_url


# ── 2. Set Worker secrets ──────────────────────────────────────────────────

def set_secret(token: str, account_id: str, name: str, value: str) -> None:
    url = f"{CF_API_BASE}/accounts/{account_id}/workers/scripts/{WORKER_NAME}/secrets"
    resp = requests.put(
        url,
        headers=cf_headers(token),
        json={"name": name, "text": value, "type": "secret_text"},
        timeout=10,
    )
    data = resp.json()
    if data.get("success"):
        print(f"[OK] Secret set: {name}")
    else:
        print(f"[WARN] Secret {name} failed: {data.get('errors')}")


# ── 3. Enable Worker routes (make it publicly accessible) ──────────────────

def enable_worker_route(token: str, account_id: str) -> None:
    """Workers are accessible at .workers.dev by default — just ensure it's enabled."""
    url = f"{CF_API_BASE}/accounts/{account_id}/workers/scripts/{WORKER_NAME}/subdomain"
    resp = requests.post(
        url,
        headers=cf_headers(token),
        json={"enabled": True},
        timeout=10,
    )
    data = resp.json()
    if data.get("success"):
        print("[OK] workers.dev route enabled")
    else:
        # Non-fatal — might already be enabled
        print(f"[INFO] Route enable: {data.get('errors', 'already enabled')}")


# ── 4. Telegram setWebhook ─────────────────────────────────────────────────

def set_telegram_webhook(bot_token: str, worker_url: str, secret: str) -> None:
    url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
    resp = requests.post(
        url,
        json={"url": worker_url, "secret_token": secret},
        timeout=10,
    )
    data = resp.json()
    if data.get("ok"):
        print(f"[OK] Telegram webhook set → {worker_url}")
    else:
        print(f"[ERROR] Telegram setWebhook failed: {data}")
        sys.exit(1)


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    load_env(ENV_FILE)

    cf_token    = require("CLOUDFLARE_API_TOKEN",
                          "dashboard.cloudflare.com → My Profile → API Tokens (Workers Scripts:Edit)")
    account_id  = require("CLOUDFLARE_ACCOUNT_ID",
                          "dashboard.cloudflare.com → Home → Account ID (right sidebar)")
    tg_token    = require("TELEGRAM_BOT_TOKEN")
    github_pat  = require("GITHUB_PAT",
                          "github.com → Settings → Developer settings → PAT (scope: workflow)")
    repo_owner  = os.environ.get("REPO_OWNER", "shalevgigi-VKS")
    repo_name   = os.environ.get("REPO_NAME",  "Claude")

    # Auto-generate TELEGRAM_SECRET if not set
    tg_secret = os.environ.get("TELEGRAM_SECRET", "").strip()
    if not tg_secret:
        tg_secret = f"chadshani_{secrets.token_hex(12)}"
        print(f"[INFO] Generated TELEGRAM_SECRET: {tg_secret}")
        print(f"[INFO] Add to .env: TELEGRAM_SECRET={tg_secret}")

    if not WORKER_JS.exists():
        print(f"[ERROR] worker.js not found: {WORKER_JS}")
        sys.exit(1)

    js_code = WORKER_JS.read_text(encoding="utf-8")

    print("\n── Step 1: Upload Worker ──────────────────────────────")
    worker_url = upload_worker(cf_token, account_id, js_code)

    print("\n── Step 2: Set Worker secrets ─────────────────────────")
    enable_worker_route(cf_token, account_id)
    set_secret(cf_token, account_id, "GITHUB_PAT",        github_pat)
    set_secret(cf_token, account_id, "REPO_OWNER",        repo_owner)
    set_secret(cf_token, account_id, "REPO_NAME",         repo_name)
    set_secret(cf_token, account_id, "TELEGRAM_SECRET",   tg_secret)

    print("\n── Step 3: Set Telegram Webhook ───────────────────────")
    set_telegram_webhook(tg_token, worker_url, tg_secret)

    print(f"""
══════════════════════════════════════════════════════
  הגדרה הושלמה בהצלחה!

  Worker URL:  {worker_url}
  שלח "עדכון" בטלגרם → GitHub Actions יתחיל תוך שניות
══════════════════════════════════════════════════════""")


if __name__ == "__main__":
    main()
