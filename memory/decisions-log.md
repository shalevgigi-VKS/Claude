# יומן החלטות

| תאריך | החלטה | סיבה |
|-------|--------|-------|
| 2026-03-14 | CLAUDE.md תלת-חלקי | זהות + מנהל + דוחס בקובץ אחד |
| 2026-03-14 | מבנה תיקיות: docs/memory/skills | הפרדה ברורה בין הקשר לסוכנים |
| 2026-03-14 17:24 | `d480c97` | test: verify post-commit hook | memory/decisions-log.md |
| 2026-03-14 17:24 | `2501fa8` | cleanup: remove test line from decisions-log | memory/decisions-log.md |
| 2026-03-14 17:26 | `edb2ee0` | layer 3: manager+compactor slash commands, update memory | .claude/commands/compactor.md,.claude/commands/manager.md,memory/active-context.md,memory/decisions-log.md,primer.md |
| 2026-03-14 17:29 | `ca54b61` | layer 4: extract, anti-hallucination, latest-docs, security-audit commands | .claude/commands/anti-hallucination.md,.claude/commands/extract.md,.claude/commands/latest-docs.md,.claude/commands/security-audit.md,memory/decisions-log.md |
| 2026-03-14 17:32 | `8208b13` | layer 6: placeholder commands for future agents | .claude/commands/file-manager.md,.claude/commands/project-manager.md,.claude/commands/research-agent.md,.claude/commands/skill-tester.md,memory/decisions-log.md |
| 2026-03-14 17:32 | `5ea40e9` | primer: full system status update | primer.md |
| 2026-03-14 20:14 | `bbd679c` | fix: pull --rebase before commit to prevent push rejection | .github/workflows/chadshani.yml |
| 2026-03-14 20:15 | `a45d131` | update docs: gauges redesign, bold content, live clock, mobile ordering | docs/index.html |
| 2026-03-14 21:19 | `22fc64f` | redesign: single column, light gauges, 3D cards, ticker template, section 10, fix template pipeline | .github/workflows/chadshani.yml,chadshani/generate_website.py,chadshani/website/index.html,docs/index.html |
| 2026-03-14 21:50 | `11bac5f` | security: add .gitignore to prevent leaking .env and secrets | .gitignore |
| 2026-03-14 21:54 | `2bd3317` | fix: reduce Groq token usage and add 429 retry with backoff | chadshani/generate_news.py |
| 2026-03-14 21:55 | `eb70ed6` | fix: switch to llama-3.1-8b-instant primary to avoid 6k TPM limit | chadshani/generate_news.py |
| 2026-03-14 21:59 | `af5d2e5` | feat: switch to Gemini Flash primary (1M TPM free), Groq fallback | .github/workflows/chadshani.yml,chadshani/generate_news.py |
| 2026-03-14 22:06 | `a9c01c8` | fix: use native Gemini API instead of broken OpenAI-compat endpoint | chadshani/generate_news.py |
| 2026-03-14 22:09 | `72a6fb3` | ci: force checkout master ref and add version verification step | .github/workflows/chadshani.yml |
| 2026-03-14 22:15 | `8235fdd` | fix: use gemini-1.5-flash (stable) and reduce Groq payload to 6k chars | chadshani/generate_news.py |
| 2026-03-14 22:19 | `e39a276` | fix: commit before pull --rebase to avoid unstaged changes error | .github/workflows/chadshani.yml |
