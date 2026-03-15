/**
 * Cloudflare Worker — חדשני Telegram Webhook
 *
 * מקבל הודעות מטלגרם → מפעיל GitHub Actions workflow_dispatch
 *
 * Environment Variables (Cloudflare dashboard → Worker → Settings → Variables):
 *   GITHUB_PAT   — Personal Access Token (scope: workflow)
 *   REPO_OWNER   — שם המשתמש ב-GitHub (e.g. "shalevgigi-VKS")
 *   REPO_NAME    — שם הריפו (e.g. "Claude")
 *   TELEGRAM_SECRET — טוקן סודי לאימות (אופציונלי, כל מחרוזת שתבחר)
 *
 * הגדרת webhook בטלגרם (פעם אחת):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<worker>.workers.dev&secret_token=<TELEGRAM_SECRET>"
 */

const TRIGGER_WORDS = ['עדכן', 'עדכון', 'חדשות', 'update', 'news'];
const COOLDOWN_MS   = 5 * 60 * 1000;  // 5 דקות בין הפעלות

// KV namespace נדרש לcooldown (אופציונלי — ללא KV הcooldown מושבת)
let lastTrigger = 0;

export default {
  async fetch(request, env) {
    // אימות secret_token (הגנה מפני בקשות זדוניות)
    if (env.TELEGRAM_SECRET) {
      const header = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (header !== env.TELEGRAM_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // קבל ופרס את גוף ה-JSON
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const text = body?.message?.text || body?.channel_post?.text || '';

    // בדוק אם ההודעה מכילה מילת trigger
    const isTrigger = TRIGGER_WORDS.some(w => text.includes(w));
    if (!isTrigger) {
      return new Response('ok');
    }

    // Cooldown (in-memory, מתאפס בין deployments)
    const now = Date.now();
    if (now - lastTrigger < COOLDOWN_MS) {
      console.log('[COOLDOWN] ignoring trigger, too soon');
      return new Response('ok');
    }
    lastTrigger = now;

    // הפעל GitHub Actions workflow_dispatch
    const dispatchUrl = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/actions/workflows/chadshani-generator.yml/dispatches`;

    try {
      const resp = await fetch(dispatchUrl, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_PAT}`,
          'Accept':        'application/vnd.github+json',
          'Content-Type':  'application/json',
          'User-Agent':    'ChadshaniWorker/1.0',
        },
        body: JSON.stringify({ ref: 'master' }),
      });

      if (resp.ok) {
        console.log('[DISPATCHED] GitHub Actions triggered');
      } else {
        const err = await resp.text();
        console.error('[DISPATCH_ERROR]', resp.status, err);
      }
    } catch (e) {
      console.error('[FETCH_ERROR]', e.message);
    }

    return new Response('ok');
  },
};
