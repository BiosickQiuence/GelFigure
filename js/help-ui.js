// @ts-check
/* Searchable Help modal, ? keyboard shortcuts sheet, and tour replay wiring (4.4). */
(function (G) {
  'use strict';
  /** @type {any} */
  const win = G;

  /** @param {string} query */
  function filterHelp(query) {
    const dlg = document.getElementById('helpDlg');
    if (!dlg) return;
    const q = String(query || '').trim().toLowerCase();
    const nodes = dlg.querySelectorAll('.help-entry, #helpDlg li, #helpDlg h3');
    if (!q) {
      nodes.forEach(n => n.classList.remove('hidden'));
      return;
    }
    dlg.querySelectorAll('.help-entry').forEach(entry => {
      const txt = (entry.textContent || '').toLowerCase();
      entry.classList.toggle('hidden', !txt.includes(q));
    });
    dlg.querySelectorAll('li').forEach(li => {
      const txt = (li.textContent || '').toLowerCase();
      li.classList.toggle('hidden', !txt.includes(q));
    });
  }

  function openShortcuts() {
    const dlg = document.getElementById('shortcutsDlg');
    if (dlg) dlg.classList.remove('hidden');
  }
  function closeShortcuts() {
    const dlg = document.getElementById('shortcutsDlg');
    if (dlg) dlg.classList.add('hidden');
  }

  function init() {
    const search = /** @type {HTMLInputElement | null} */ (document.getElementById('helpSearch'));
    if (search) {
      search.addEventListener('input', () => filterHelp(search.value));
    }
    const replay = document.getElementById('btnReplayTour');
    if (replay) {
      replay.addEventListener('click', () => {
        const help = document.getElementById('helpDlg');
        if (help) help.classList.add('hidden');
        if (win.Onboarding) win.Onboarding.start(true);
      });
    }
    const scBtn = document.getElementById('btnOpenShortcuts');
    if (scBtn) {
      scBtn.addEventListener('click', () => {
        const help = document.getElementById('helpDlg');
        if (help) help.classList.add('hidden');
        openShortcuts();
      });
    }
    const scClose = document.getElementById('btnShortcutsClose');
    if (scClose) scClose.addEventListener('click', closeShortcuts);

    window.addEventListener('keydown', e => {
      const t = /** @type {HTMLElement | null} */ (e.target);
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const dlg = document.getElementById('shortcutsDlg');
        if (dlg) dlg.classList.toggle('hidden');
      } else if (e.key === 'Escape') {
        closeShortcuts();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  win.HelpUI = { filterHelp, openShortcuts, closeShortcuts };
})(window);
