/**
 * script.js — חדשני | Hadashni News Desk
 * Modules: Live Clock, Carousel, News Card Builder, Copy/Export
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   1. LIVE CLOCK & HEBREW DATE
═══════════════════════════════════════════════════════════ */

const HEBREW_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const HEBREW_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];

function updateClock() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const clockEl = document.getElementById('live-clock');
  if (clockEl) clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateEl = document.getElementById('live-date');
  if (dateEl) {
    const day   = HEBREW_DAYS[now.getDay()];
    const month = HEBREW_MONTHS[now.getMonth()];
    dateEl.textContent = `יום ${day}, ${now.getDate()} ב${month} ${now.getFullYear()}`;
  }
}

updateClock();
setInterval(updateClock, 1000);


/* ═══════════════════════════════════════════════════════════
   2. IMAGE CAROUSEL
   Images served from ./karusela/ (relative to docs/)
═══════════════════════════════════════════════════════════ */

const CAROUSEL_IMAGES = [
  { src: './karusela/1.png', alt: 'תמונה 1' },
  { src: './karusela/2.png', alt: 'תמונה 2' },
  { src: './karusela/3.png', alt: 'תמונה 3' },
];

class Carousel {
  constructor(wrapper) {
    this.wrapper = wrapper;
    this.current = 0;
    this.timer   = null;
    this._build();
    this._start();
  }

  _build() {
    const track = this.wrapper.querySelector('.carousel-track');
    if (!track) return;

    // Build slides
    this.slides = CAROUSEL_IMAGES.map((img, i) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide' + (i === 0 ? ' active' : '');
      const el = document.createElement('img');
      el.src     = img.src;
      el.alt     = img.alt;
      el.loading = i === 0 ? 'eager' : 'lazy';
      slide.appendChild(el);
      track.appendChild(slide);
      return slide;
    });

    // Dots
    const dotsEl = this.wrapper.querySelector('.carousel-dots');
    if (dotsEl) {
      this.dots = CAROUSEL_IMAGES.map((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `תמונה ${i + 1}`);
        dot.addEventListener('click', () => this._go(i));
        dotsEl.appendChild(dot);
        return dot;
      });
    }

    // Prev / Next buttons
    this.wrapper.querySelector('.carousel-btn.prev')
      ?.addEventListener('click', () => this._go(this.current - 1));
    this.wrapper.querySelector('.carousel-btn.next')
      ?.addEventListener('click', () => this._go(this.current + 1));

    // Pause on hover
    this.wrapper.addEventListener('mouseenter', () => this._stop());
    this.wrapper.addEventListener('mouseleave', () => this._start());

    // Touch / swipe (RTL-aware: swipe right → prev)
    let touchX = 0;
    this.wrapper.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    this.wrapper.addEventListener('touchend', e => {
      const diff = e.changedTouches[0].clientX - touchX;
      if (Math.abs(diff) > 40) this._go(diff > 0 ? this.current - 1 : this.current + 1);
    });
  }

  _go(index) {
    const n    = CAROUSEL_IMAGES.length;
    const next = ((index % n) + n) % n;
    if (next === this.current) return;
    this.slides[this.current].classList.remove('active');
    if (this.dots) this.dots[this.current].classList.remove('active');
    this.slides[next].classList.add('active');
    if (this.dots) this.dots[next].classList.add('active');
    this.current = next;
    this._stop();
    setTimeout(() => this._start(), 750);
  }

  _start() { if (!this.timer) this.timer = setInterval(() => this._go(this.current + 1), 4500); }
  _stop()  { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
}


/* ═══════════════════════════════════════════════════════════
   3. SECTIONS METADATA (numbered 1–12, matching Gemini output)
═══════════════════════════════════════════════════════════ */

const SECTIONS_META = [
  { num: 1,  icon: '📊', label: 'מדד פחד וחמדנות + תמונת מצב',
    border: '#fcd34d', bg: 'rgba(255,251,235,.85)', lb: '#fef3c7', tc: '#92400e', type: 'hero' },
  { num: 2,  icon: '🌐', label: 'מכ"ם גיאופוליטי',
    border: '#86efac', bg: 'rgba(240,253,244,.85)', lb: '#dcfce7', tc: '#14532d', type: 'section' },
  { num: 3,  icon: '📈', label: 'שוק ההון הכללי',
    border: '#93c5fd', bg: 'rgba(239,246,255,.85)', lb: '#dbeafe', tc: '#1e3a8a', type: 'section' },
  { num: 4,  icon: '🗺', label: 'מפת הסקטורים',
    border: '#c4b5fd', bg: 'rgba(250,245,255,.85)', lb: '#ede9fe', tc: '#4c1d95', type: 'section' },
  { num: 5,  icon: '💰', label: 'מעקב קרנות הון סיכון',
    border: '#6ee7b7', bg: 'rgba(236,253,245,.85)', lb: '#d1fae5', tc: '#064e3b', type: 'section' },
  { num: 6,  icon: '₿',  label: 'שוק הקריפטו',
    border: '#fdba74', bg: 'rgba(255,247,237,.85)', lb: '#ffedd5', tc: '#7c2d12', type: 'section' },
  { num: 7,  icon: '⚡', label: 'סקטור השבבים',
    border: '#7dd3fc', bg: 'rgba(240,249,255,.85)', lb: '#e0f2fe', tc: '#0c4a6e', type: 'section' },
  { num: 8,  icon: '💻', label: 'תוכנה וסייבר',
    border: '#e879f9', bg: 'rgba(253,244,255,.85)', lb: '#fae8ff', tc: '#701a75', type: 'section' },
  { num: 9,  icon: '🤖', label: 'מודלים ו-AI',
    border: '#a78bfa', bg: 'rgba(245,243,255,.85)', lb: '#ede9fe', tc: '#4c1d95', type: 'section' },
  { num: 10, icon: '🛠', label: 'כלי AI יומיומיים',
    border: '#5eead4', bg: 'rgba(240,253,250,.85)', lb: '#ccfbf1', tc: '#134e4a', type: 'section' },
  { num: 11, icon: '📌', label: 'סיכום: טיקרים וסיכונים',
    border: '#fda4af', bg: 'rgba(255,241,242,.85)', lb: '#ffe4e6', tc: '#881337', type: 'tickers' },
  { num: 12, icon: '⚠️', label: 'זווית איפכא מסתברא',
    border: '#f97316', bg: 'rgba(255,247,237,.85)', lb: '#ffedd5', tc: '#7c2d12', type: 'redteam' },
];

// Fallback cfg for unexpected section numbers
function getCfg(num) {
  return SECTIONS_META.find(c => c.num === num) || {
    num, icon: '📋', label: `סעיף ${num}`,
    border: '#94a3b8', bg: 'rgba(248,250,252,.85)', lb: '#e2e8f0', tc: '#0f172a', type: 'section',
  };
}


/* ═══════════════════════════════════════════════════════════
   4. HELPERS
═══════════════════════════════════════════════════════════ */

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(s) {
  return escHtml(s || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\+(\d[\d.,]*\s*%?)/g, '<span class="chg-up">+$1</span>')
    .replace(/(?<![A-Za-z\d])-(\d[\d.,]*\s*%)/g, '<span class="chg-dn">-$1</span>');
}

function fngStyle(val) {
  if (val == null) return { color: '#64748b', bg: '#e2e8f0', label: 'N/A' };
  if (val <= 24)   return { color: '#dc2626', bg: '#fee2e2', label: 'פחד קיצוני' };
  if (val <= 44)   return { color: '#ea580c', bg: '#fed7aa', label: 'פחד' };
  if (val <= 54)   return { color: '#ca8a04', bg: '#fef9c3', label: 'ניטרלי' };
  if (val <= 74)   return { color: '#059669', bg: '#d1fae5', label: 'חמדנות' };
                   return { color: '#16a34a', bg: '#bbf7d0', label: 'חמדנות קיצונית' };
}

function vixStyle(val) {
  if (val == null) return { color: '#64748b', bg: '#e2e8f0', label: 'N/A' };
  if (val > 25)    return { color: '#dc2626', bg: '#fee2e2', label: 'סיכון גבוה' };
  if (val > 15)    return { color: '#ca8a04', bg: '#fef9c3', label: 'מתון' };
                   return { color: '#059669', bg: '#d1fae5', label: 'נמוך' };
}


/* ═══════════════════════════════════════════════════════════
   5. CARD BUILDERS
═══════════════════════════════════════════════════════════ */

function buildGaugeRow(gauges) {
  const fng = gauges.fng != null ? Math.round(gauges.fng) : null;
  const vix = gauges.vix != null ? parseFloat(gauges.vix) : null;
  const fs  = fngStyle(fng);
  const vs  = vixStyle(vix);

  return `
<div class="gauge-row">
  <div class="card card--gauge">
    <div class="gauge-label">CNN Fear &amp; Greed</div>
    <div class="gauge-number" style="color:${fs.color}">${fng != null ? fng : '—'}</div>
    <span class="gauge-sentiment" style="background:${fs.bg};color:${fs.color}">${fs.label}</span>
  </div>
  <div class="card card--gauge">
    <div class="gauge-label">VIX</div>
    <div class="gauge-number" style="color:${vs.color}">${vix != null ? vix.toFixed(1) : '—'}</div>
    <span class="gauge-sentiment" style="background:${vs.bg};color:${vs.color}">${vs.label}</span>
  </div>
</div>`;
}

function buildTickerList(content) {
  const lines = (content || '').split('\n');
  let html = '<div class="ticker-list">';
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    // Match **TICKER** — Name — Description
    const m = t.match(/^\*\*([A-Z0-9.\-]+)\*\*\s*[—\-–]\s*(.+?)\s*[—\-–]\s*(.+)$/);
    if (m) {
      html += `<div class="ticker-row">
        <span class="ticker-badge">${escHtml(m[1])}</span>
        <span class="ticker-name">${escHtml(m[2])}</span>
        <span class="ticker-sep">—</span>
        <span class="ticker-desc">${renderMarkdown(m[3])}</span>
      </div>`;
    } else if (/^\*\*.+\*\*:?\s*$/.test(t)) {
      html += `<div class="ticker-header">${renderMarkdown(t)}</div>`;
    } else {
      html += `<div class="ticker-row"><span class="ticker-desc">${renderMarkdown(t)}</span></div>`;
    }
  }
  return html + '</div>';
}

function buildCardHTML(sec, cfg) {
  const extraClass = cfg.type === 'redteam' ? ' card--redteam' : '';
  const body = cfg.type === 'tickers'
    ? buildTickerList(sec.content)
    : `<div class="section-content">${renderMarkdown(sec.content)}</div>`;

  return `
<div class="card card--section${extraClass}" id="section-${sec.num}"
  style="border-top:3px solid ${cfg.border};background:${cfg.bg}">
  <div class="card-header">
    <div class="card-icon" style="background:${cfg.lb};color:${cfg.tc}">${cfg.icon}</div>
    <div class="card-title" style="color:${cfg.tc}">${escHtml(sec.title || cfg.label)}</div>
    <button class="btn-copy" onclick="copySection(${sec.num},this)">העתק</button>
  </div>
  <div class="card-body">${body}</div>
</div>`;
}


/* ═══════════════════════════════════════════════════════════
   6. MAIN INIT — NEWS CARDS
═══════════════════════════════════════════════════════════ */

function initNewsCards() {
  const dataEl  = document.getElementById('news-data');
  const gaugeEl = document.getElementById('gauges-data');
  let sections = [], gauges = {};

  try { sections = JSON.parse(dataEl?.textContent?.trim() || '[]'); }  catch (_) {}
  try { gauges   = JSON.parse(gaugeEl?.textContent?.trim() || '{}'); } catch (_) {}

  // Update header badge + page title
  const ts    = dataEl?.dataset.updated || '';
  const badge = document.getElementById('ts-badge');
  if (badge) badge.textContent = ts ? `עודכן: ${ts}` : 'טרם עודכן';
  if (ts)    document.title = `חדשני | ${ts}`;

  if (!sections.length) return;

  const main = document.getElementById('main-content');
  if (!main) return;

  // Hide loading state
  const emptyEl = document.getElementById('empty-state');
  if (emptyEl) emptyEl.style.display = 'none';

  let html = '';

  // Gauge row (CNN F&G + VIX)
  html += buildGaugeRow(gauges);

  // Hero card — section 1 (Fear & Greed + market snapshot)
  const heroSec = sections.find(s => s.num === 1);
  if (heroSec) {
    const cfg = getCfg(1);
    html += `
<div class="card card--hero" id="section-1"
  style="border-top:3px solid ${cfg.border};background:${cfg.bg}">
  <div class="card-header">
    <div class="card-icon" style="background:${cfg.lb};color:${cfg.tc}">${cfg.icon}</div>
    <div class="card-title" style="color:${cfg.tc}">${escHtml(heroSec.title || cfg.label)}</div>
    <button class="btn-copy" onclick="copySection(1,this)">העתק</button>
  </div>
  <div class="card-body">
    <div class="section-content">${renderMarkdown(heroSec.content)}</div>
  </div>
</div>`;
  }

  // Data grid — sections 2–12
  const gridSections = sections.filter(s => s.num !== 1);
  if (gridSections.length) {
    html += '<div class="data-grid">';
    for (const sec of gridSections) {
      html += buildCardHTML(sec, getCfg(sec.num));
    }
    html += '</div>';
  }

  main.insertAdjacentHTML('beforeend', html);
}


/* ═══════════════════════════════════════════════════════════
   7. COPY & EXPORT
═══════════════════════════════════════════════════════════ */

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function copySection(num, btn) {
  const card = document.getElementById(`section-${num}`);
  if (!card) return;
  const title   = card.querySelector('.card-title')?.textContent  || '';
  const content = card.querySelector('.section-content')?.textContent || '';
  navigator.clipboard.writeText(`${title}\n\n${content}`).then(() => {
    btn.textContent = '✓ הועתק';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'העתק'; btn.classList.remove('copied'); }, 2000);
    showToast('הסעיף הועתק ללוח');
  }).catch(() => showToast('שגיאה בהעתקה'));
}

function exportAll() {
  const ts    = document.getElementById('ts-badge')?.textContent || '';
  const parts = [`חדשני — מעדכן החדשות\n${ts}\n${'═'.repeat(50)}`];
  document.querySelectorAll('.card--hero, .card--section').forEach(card => {
    const title   = card.querySelector('.card-title')?.textContent  || '';
    const content = card.querySelector('.section-content')?.textContent || '';
    if (title || content) parts.push(`\n${title}\n${'-'.repeat(30)}\n${content}`);
  });
  navigator.clipboard.writeText(parts.join('\n')).then(
    () => showToast('כל הדסק הועתק ✓')
  ).catch(() => showToast('שגיאה בייצוא'));
}

// Expose to inline onclick handlers
window.copySection = copySection;
window.exportAll   = exportAll;


/* ═══════════════════════════════════════════════════════════
   8. BOOTSTRAP
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('.carousel-wrapper');
  if (wrapper) new Carousel(wrapper);
  initNewsCards();
});
