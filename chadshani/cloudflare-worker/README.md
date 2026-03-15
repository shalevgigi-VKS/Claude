# Cloudflare Worker — חדשני Telegram Trigger

## מה זה עושה
מקבל הודעות Telegram webhook → מפעיל GitHub Actions `workflow_dispatch`.
כשמישהו שולח "עדכון" / "עדכן" / "חדשות" / "update" / "news" — ה-workflow `chadshani-generator.yml` מופעל.

## פריסה (פעם אחת)

### 1. צור Cloudflare חשבון (חינם)
cloudflare.com → Workers & Pages → Create Worker → הדבק את `worker.js`

### 2. הגדר Environment Variables (Workers → Settings → Variables)
| שם | ערך |
|----|-----|
| `GITHUB_PAT` | GitHub PAT עם scope `workflow` (github.com → Settings → Developer settings → PAT) |
| `REPO_OWNER` | `shalevgigi-VKS` (שם המשתמש ב-GitHub) |
| `REPO_NAME` | `Claude` (שם הריפו) |
| `TELEGRAM_SECRET` | כל מחרוזת סודית (לדוגמה: `mychadshani2024`) |

### 3. הגדר Telegram Webhook (פקודת curl — פעם אחת)
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook\
?url=https://<WORKER_NAME>.<ACCOUNT>.workers.dev\
&secret_token=<TELEGRAM_SECRET>"
```

החלף:
- `<TELEGRAM_BOT_TOKEN>` — מ-`.env` או מ-BotFather
- `<WORKER_NAME>` — השם שנתת ל-Worker ב-Cloudflare
- `<ACCOUNT>` — שם החשבון ב-Cloudflare
- `<TELEGRAM_SECRET>` — אותה מחרוזת שהכנסת ב-Variables

### 4. בדוק
שלח "עדכון" בטלגרם → בדוק ב-GitHub Actions שה-workflow הופעל.

## זרימה מלאה
```
שלח "עדכון" בטלגרם
        ↓
Telegram API
        ↓
Cloudflare Worker (webhook)
        ↓
GitHub API /dispatches
        ↓
GitHub Actions: chadshani-generator.yml
        ↓
generate_news.py (Gemini + RSS)
        ↓
generate_website.py (HTML + deploy)
        ↓
GitHub Pages מתעדכן
        ↓
הודעת Telegram עם קישור לאתר
```

## עלות
- Cloudflare Workers: **חינם** (100,000 requests/day)
- GitHub Actions: **חינם** (2000 דקות/חודש בחשבון free)
- Gemini API: **חינם** (1500 requests/day ב-free tier)
- Groq API: **חינם** (fallback)
