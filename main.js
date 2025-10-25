/* ph-pharma.script.js
   Lightweight JavaScript for Ph-Pharma.html
   --------------------------------------------------
   This file contains vanilla JS utilities used by the HTML:
   - theme (dark) toggle with system preference fallback
   - mobile menu toggle
   - simple search/filter for tables or lists
   - table sorting (basic, for numeric and string columns)
   - modal open/close helpers
   - copy-to-clipboard utility (useful for phone / WhatsApp links)
   - placeholder Chart initialization wrapper (detects Chart.js and mounts)

   Instructions:
   1) Include this file near the end of your HTML, before </body>:
      <script src="/path/to/ph-pharma.script.js"></script>
   2) If you use Chart.js, include it before this script, or this script will leave
      a clear placeholder that you can fill later.

   Notes:
   - This code avoids any frameworks, uses modern DOM APIs, and is defensive (won't throw
     if elements are missing).
   - Customize selectors below to match your markup.
*/

(() => {
  'use strict';

  /* ----------------------
     Helper utilities
     ---------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ----------------------
     Theme toggle (dark mode)
     - toggles `class="dark"` on <html>
     - stores preference in localStorage
     ---------------------- */
  const THEME_KEY = 'phpharma:theme';
  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function storeTheme(value) {
    try { localStorage.setItem(THEME_KEY, value); } catch (e) {}
  }
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
  }
  // initialize theme on load
  (function initTheme() {
    const stored = getStoredTheme();
    if (stored) applyTheme(stored);
    else applyTheme(systemPrefersDark() ? 'dark' : 'light');
  })();

  // delegate toggle button(s)
  $$('.dark-mode-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      storeTheme(isDark ? 'dark' : 'light');
      // optional: emit a small custom event
      window.dispatchEvent(new CustomEvent('ph-theme-changed', { detail: { theme: isDark ? 'dark' : 'light' } }));
    });
  });

  /* ----------------------
     Mobile menu toggle
  ---------------------- */
  $$('.mobile-menu-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSelector = btn.getAttribute('data-target');
      const menu = targetSelector ? document.querySelector(targetSelector) : btn.nextElementSibling;
      if (!menu) return;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('hidden');
    });
  });

  /* ----------------------
     Simple search / filter
     - input elements with `data-filter-target="#listOrTable"` will filter children
     - filters by textContent (case-insensitive)
  ---------------------- */
  $$('input[data-filter-target]').forEach(input => {
    const target = document.querySelector(input.dataset.filterTarget);
    if (!target) return;
    const items = Array.from(target.children);
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      items.forEach(it => {
        const text = it.textContent.trim().toLowerCase();
        it.style.display = q === '' || text.includes(q) ? '' : 'none';
      });
    });
  });

  /* ----------------------
     Table sorting (basic)
     Usage: add class `sortable` to <table> and clickable <th data-sort="colIndex" data-type="string|number">
     The script will sort rows in the <tbody>.
  ---------------------- */
  function parseCellValue(cell, type) {
    const txt = cell.textContent.trim();
    if (type === 'number') {
      // remove commas and currency symbols
      const n = txt.replace(/[,$\s%]/g, '');
      const v = parseFloat(n);
      return Number.isFinite(v) ? v : -Infinity;
    }
    return txt.toLowerCase();
  }
  $$('table.sortable').forEach(table => {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const makeSortHandler = (index, type) => () => {
      const rows = Array.from(tbody.rows);
      const currentAsc = table.getAttribute('data-sort-col') === String(index) && table.getAttribute('data-sort-dir') === 'asc';
      const dir = currentAsc ? -1 : 1;
      rows.sort((a, b) => {
        const va = parseCellValue(a.cells[index] || { textContent: '' }, type);
        const vb = parseCellValue(b.cells[index] || { textContent: '' }, type);
        if (va === vb) return 0;
        return va > vb ? dir : -dir;
      });
      // reattach
      rows.forEach(r => tbody.appendChild(r));
      table.setAttribute('data-sort-col', String(index));
      table.setAttribute('data-sort-dir', dir === 1 ? 'asc' : 'desc');
    };

    // wire up headers
    Array.from(table.querySelectorAll('th[data-sort]')).forEach(th => {
      const idx = parseInt(th.dataset.sort, 10);
      const type = th.dataset.type || 'string';
      th.style.cursor = 'pointer';
      th.addEventListener('click', makeSortHandler(idx, type));
    });
  });

  /* ----------------------
     Modal utilities
     - open: add `data-modal-open="#modalId"` on an element
     - close: add `data-modal-close` on close buttons
  ---------------------- */
  $$('[data-modal-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sel = btn.dataset.modalOpen;
      const modal = document.querySelector(sel);
      if (!modal) return;
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      // trap focus could be added here
    });
  });
  $$('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal') || document.querySelector(btn.dataset.modalClose || '');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    });
  });

  // Close modal when clicking on overlay (expects .modal as wrapper and .modal-content inside)
  $$('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.classList.contains('modal')) {
        modal.classList.add('hidden');
      }
    });
  });

  /* ----------------------
     Copy to clipboard helper
     - elements with .copy-btn and attribute data-copy="text to copy" will copy to clipboard
     - if data-copy-target is provided, copies the target element's textContent
  ---------------------- */
  $$('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy || (btn.dataset.copyTarget ? (document.querySelector(btn.dataset.copyTarget) || {}).textContent : '');
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1500);
      } catch (err) {
        console.warn('Copy failed', err);
      }
    });
  });

  /* ----------------------
     Chart mounting helper
     - Looks for elements with .chart-canvas and data-chart-config (JSON selector id or inline JSON)
     - If Chart.js is present (window.Chart), it will mount a chart
     - Otherwise, leaves a skeleton / placeholder
  ---------------------- */
  function mountCharts() {
    const canvases = $$('.chart-canvas');
    if (!canvases.length) return;
    if (!window.Chart) {
      // If Chart.js isn't loaded, add a note to developer console and leave placeholders.
      console.info('Chart.js not found. Include Chart.js to render charts. Example: <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>');
      canvases.forEach(c => c.classList.add('skeleton'));
      return;
    }
    canvases.forEach(canvas => {
      const cfgAttr = canvas.getAttribute('data-chart-config');
      let cfg = null;
      try {
        if (cfgAttr && cfgAttr.trim().startsWith('{')) cfg = JSON.parse(cfgAttr);
        else if (cfgAttr && document.querySelector(cfgAttr)) cfg = JSON.parse(document.querySelector(cfgAttr).textContent);
      } catch (e) {
        console.warn('Failed to parse chart config for', canvas, e);
      }
      if (!cfg) {
        // create a simple default line chart as fallback
        cfg = {
          type: 'line',
          data: { labels: ['Jan','Feb','Mar','Apr','May','Jun'], datasets: [{ label: 'Example', data: [3,2,5,4,6,7], fill: false }] },
          options: { responsive: true, maintainAspectRatio: false }
        };
      }
      // eslint-disable-next-line no-new
      new Chart(canvas.getContext('2d'), cfg);
    });
  }
  mountCharts();

  /* ----------------------
     Small UX helpers
     - sticky header toggle: toggles .scrolled when window scrolled beyond threshold
  ---------------------- */
  (function stickyHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const threshold = 24;
    window.addEventListener('scroll', () => {
      if (window.scrollY > threshold) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    }, { passive: true });
  })();

  /* ----------------------
     Accessibility small improvements
     - ensure all interactive elements have keyboard support
  ---------------------- */
  document.addEventListener('keydown', (e) => {
    // close modal on Escape
    if (e.key === 'Escape') {
      $$('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
  });

  /* ----------------------
     Public API (for custom scripts to call)
  ---------------------- */
  window.PhPharma = {
    applyTheme,
    mountCharts,
    copyText: async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
  };

})();
