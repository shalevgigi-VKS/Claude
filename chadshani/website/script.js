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
   3. SECTOR MAP — קבוע (תמיד 11 שורות, רק % מתעדכן)
═══════════════════════════════════════════════════════════ */

const SECTORS_MAP = [
  { etf: 'XLK',  name: 'טכנולוגיה' },
  { etf: 'XLV',  name: 'בריאות' },
  { etf: 'XLF',  name: 'פיננסים' },
  { etf: 'XLE',  name: 'אנרגיה' },
  { etf: 'XLY',  name: 'צרכנות שיקולית' },
  { etf: 'XLP',  name: 'צרכנות בסיסית' },
  { etf: 'XLU',  name: 'שירותים ציבוריים' },
  { etf: 'XLI',  name: 'תעשייה' },
  { etf: 'XLB',  name: 'חומרים' },
  { etf: 'XLRE', name: 'נדל"ן' },
  { etf: 'XLC',  name: 'תקשורת ומדיה' },
];


/* ═══════════════════════════════════════════════════════════
   4. SECTIONS METADATA (numbered 1–9, תואם לפרומפט)
═══════════════════════════════════════════════════════════ */

const SECTIONS_META = [
  { num: 1, icon: '📊', label: 'תמונת מצב מיידית',
    border: '#fcd34d', bg: 'rgba(255,251,235,.85)', lb: '#fef3c7', tc: '#92400e', type: 'hero' },
  { num: 2, icon: '📈', label: 'שוק ההון הכללי',
    border: '#93c5fd', bg: 'rgba(239,246,255,.85)', lb: '#dbeafe', tc: '#1e3a8a', type: 'section' },
  { num: 3, icon: '🗺', label: 'מפת הסקטורים',
    border: '#c4b5fd', bg: 'rgba(250,245,255,.85)', lb: '#ede9fe', tc: '#4c1d95', type: 'sectors' },
  { num: 4, icon: '₿',  label: 'שוק הקריפטו',
    border: '#fdba74', bg: 'rgba(255,247,237,.85)', lb: '#ffedd5', tc: '#7c2d12', type: 'section' },
  { num: 5, icon: '⚡', label: 'סקטור השבבים',
    border: '#7dd3fc', bg: 'rgba(240,249,255,.85)', lb: '#e0f2fe', tc: '#0c4a6e', type: 'section' },
  { num: 6, icon: '💻', label: 'סקטור התוכנה וסייבר',
    border: '#e879f9', bg: 'rgba(253,244,255,.85)', lb: '#fae8ff', tc: '#701a75', type: 'section' },
  { num: 7, icon: '🤖', label: 'תחום ה-AI',
    border: '#a78bfa', bg: 'rgba(245,243,255,.85)', lb: '#ede9fe', tc: '#4c1d95', type: 'section' },
  { num: 8, icon: '🛠', label: 'עדכוני כלי AI',
    border: '#5eead4', bg: 'rgba(240,253,250,.85)', lb: '#ccfbf1', tc: '#134e4a', type: 'section' },
  { num: 9, icon: '⚠️', label: 'אירועי סיכון 48 שעות',
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

/* ═══════════════════════════════════════════════════════════
   5a. SVG GAUGE HELPERS
═══════════════════════════════════════════════════════════ */

function _arcPath(cx, cy, r, v1, v2) {
  // v1, v2 in [0,1]: 0=left, 1=right, arc goes through top
  const a1 = Math.PI - v1 * Math.PI;
  const a2 = Math.PI - v2 * Math.PI;
  const x1 = (cx + r * Math.cos(a1)).toFixed(2);
  const y1 = (cy - r * Math.sin(a1)).toFixed(2);
  const x2 = (cx + r * Math.cos(a2)).toFixed(2);
  const y2 = (cy - r * Math.sin(a2)).toFixed(2);
  const large = (v2 - v1) > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function buildFngGaugeSVG(val) {
  const cx = 100, cy = 88, r = 68, sw = 13;
  const safeVal = val != null ? Math.max(0, Math.min(100, val)) : null;
  const v = safeVal != null ? safeVal / 100 : 0.5;
  const fs = fngStyle(safeVal);

  const zones = [
    { v1: 0,    v2: 0.25, color: '#ef4444' },
    { v1: 0.25, v2: 0.45, color: '#f97316' },
    { v1: 0.45, v2: 0.55, color: '#eab308' },
    { v1: 0.55, v2: 0.75, color: '#84cc16' },
    { v1: 0.75, v2: 1,    color: '#22c55e' },
  ];

  const na = Math.PI - v * Math.PI;
  const nx = (cx + (r - 8) * Math.cos(na)).toFixed(2);
  const ny = (cy - (r - 8) * Math.sin(na)).toFixed(2);

  const labels = [
    { v: 0,    label: '0'   }, { v: 0.25, label: '25' },
    { v: 0.5,  label: '50'  }, { v: 0.75, label: '75' },
    { v: 1,    label: '100' },
  ];

  const ticksHtml = labels.map(({ v: lv, label }) => {
    const la = Math.PI - lv * Math.PI;
    const tx = (cx + (r + 9) * Math.cos(la)).toFixed(1);
    const ty = (cy - (r + 9) * Math.sin(la) + 3.5).toFixed(1);
    return `<text x="${tx}" y="${ty}" text-anchor="middle" font-size="7" fill="#94a3b8">${label}</text>`;
  }).join('');

  return `<svg viewBox="0 0 200 118" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:210px;margin:0 auto;display:block">
  <path d="${_arcPath(cx, cy, r, 0, 1)}" fill="none" stroke="#e2e8f0" stroke-width="${sw}" stroke-linecap="butt"/>
  ${zones.map(z => `<path d="${_arcPath(cx, cy, r, z.v1, z.v2)}" fill="none" stroke="${z.color}" stroke-width="${sw}" stroke-linecap="butt" opacity="0.82"/>`).join('\n  ')}
  ${ticksHtml}
  <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="4.5" fill="#334155"/>
  <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="24" font-weight="900" fill="${fs.color}" class="gauge-number-svg" data-target="${safeVal != null ? safeVal : ''}">${safeVal != null ? safeVal : '—'}</text>
  <text x="${cx}" y="${cy + 34}" text-anchor="middle" font-size="8.5" fill="${fs.color}" font-weight="700">${fs.label}</text>
</svg>`;
}

function buildVixGaugeSVG(val) {
  const cx = 100, cy = 88, r = 68, sw = 13;
  const safeVal = val != null ? Math.max(0, Math.min(60, val)) : null;
  const v = safeVal != null ? safeVal / 50 : 0.5;  // scale 0-50
  const vs = vixStyle(safeVal);

  const zones = [
    { v1: 0,    v2: 0.30, color: '#22c55e' },  // 0-15
    { v1: 0.30, v2: 0.50, color: '#eab308' },  // 15-25
    { v1: 0.50, v2: 1,    color: '#ef4444' },  // 25-50
  ];

  const na = Math.PI - Math.min(v, 1) * Math.PI;
  const nx = (cx + (r - 8) * Math.cos(na)).toFixed(2);
  const ny = (cy - (r - 8) * Math.sin(na)).toFixed(2);

  const labels = [
    { v: 0, label: '0' }, { v: 0.3, label: '15' },
    { v: 0.5, label: '25' }, { v: 1, label: '50' },
  ];

  const ticksHtml = labels.map(({ v: lv, label }) => {
    const la = Math.PI - lv * Math.PI;
    const tx = (cx + (r + 9) * Math.cos(la)).toFixed(1);
    const ty = (cy - (r + 9) * Math.sin(la) + 3.5).toFixed(1);
    return `<text x="${tx}" y="${ty}" text-anchor="middle" font-size="7" fill="#94a3b8">${label}</text>`;
  }).join('');

  const dispVal = safeVal != null ? safeVal.toFixed(1) : '—';
  return `<svg viewBox="0 0 200 118" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:210px;margin:0 auto;display:block">
  <path d="${_arcPath(cx, cy, r, 0, 1)}" fill="none" stroke="#e2e8f0" stroke-width="${sw}" stroke-linecap="butt"/>
  ${zones.map(z => `<path d="${_arcPath(cx, cy, r, z.v1, z.v2)}" fill="none" stroke="${z.color}" stroke-width="${sw}" stroke-linecap="butt" opacity="0.82"/>`).join('\n  ')}
  ${ticksHtml}
  <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="4.5" fill="#334155"/>
  <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="24" font-weight="900" fill="${vs.color}" class="gauge-number-svg" data-target="${safeVal != null ? safeVal : ''}" data-float="1">${dispVal}</text>
  <text x="${cx}" y="${cy + 34}" text-anchor="middle" font-size="8.5" fill="${vs.color}" font-weight="700">${vs.label}</text>
</svg>`;
}

function buildGaugeRow(gauges) {
  const fng = gauges.fng != null ? Math.round(gauges.fng) : null;
  const vix = gauges.vix != null ? parseFloat(gauges.vix) : null;

  return `
<div class="gauge-row">
  <div class="card card--gauge">
    <div class="gauge-label">CNN Fear &amp; Greed</div>
    ${buildFngGaugeSVG(fng)}
  </div>
  <div class="card card--gauge">
    <div class="gauge-label">מדד התנודתיות — VIX</div>
    ${buildVixGaugeSVG(vix)}
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

function buildSectorTable(content) {
  let html = '<div class="sector-table">';
  for (const { etf, name } of SECTORS_MAP) {
    const re = new RegExp(
      String.raw`\*{0,2}${etf}\*{0,2}[^\n|]*\|[^\n|]*\|\s*([+\-]?[\d.]+\s*%?)\s*\|?([^\n]*)`,
      'i'
    );
    const m   = content.match(re);
    const pct = m ? m[1].trim() : null;
    const note = m ? m[2].trim().replace(/^\s*[-–—]\s*/, '').slice(0, 50) : '';
    const cls  = pct ? (pct.startsWith('+') ? 'chg-up' : pct.startsWith('-') ? 'chg-dn' : '') : '';
    html += `<div class="sector-row">
      <span class="sector-etf">${etf}</span>
      <span class="sector-name">${name}</span>
      <span class="sector-pct ${cls}">${pct || '—'}</span>
      ${note ? `<span class="sector-note">${escHtml(note)}</span>` : ''}
    </div>`;
  }
  html += '</div>';
  const rot = content.match(/רוטציה[^.\n]*/);
  if (rot) html += `<div class="sector-rotation">${renderMarkdown(rot[0])}</div>`;
  return html;
}

function buildCardHTML(sec, cfg) {
  const extraClass = cfg.type === 'redteam' ? ' card--redteam' : '';
  const body = cfg.type === 'tickers'  ? buildTickerList(sec.content)
             : cfg.type === 'sectors'  ? buildSectorTable(sec.content)
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
   8. 3D TILT EFFECT
═══════════════════════════════════════════════════════════ */

function initTilt() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform =
        `perspective(900px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateZ(4px)`;
      card.style.setProperty('--glare-x', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--glare-y', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}


/* ═══════════════════════════════════════════════════════════
   9. STAGGERED LOAD ANIMATIONS
═══════════════════════════════════════════════════════════ */

function initStagger() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      obs.unobserve(e.target);
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.card').forEach((card, i) => {
    card.style.animationDelay = (i * 75) + 'ms';
    obs.observe(card);
  });
}


/* ═══════════════════════════════════════════════════════════
   10. NUMBER COUNTERS (SVG gauge text)
═══════════════════════════════════════════════════════════ */

function animateCounter(el, target, isFloat, duration) {
  const start = performance.now();
  function step(now) {
    const p    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);  // cubic ease-out
    const val  = target * ease;
    el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initCounters() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el     = e.target;
      const target = parseFloat(el.dataset.target);
      const isFloat = el.dataset.float === '1';
      if (!isNaN(target)) animateCounter(el, target, isFloat, 1200);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.gauge-number-svg[data-target]').forEach(el => {
    if (el.dataset.target !== '') obs.observe(el);
  });
}


/* ═══════════════════════════════════════════════════════════
   11. BOOTSTRAP
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('.carousel-wrapper');
  if (wrapper) new Carousel(wrapper);
  initNewsCards();
  initTilt();
  initStagger();
  initCounters();
});
