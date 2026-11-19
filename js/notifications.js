// @ts-check
/* Unified notification layer (V7) and on-demand info popovers (V3).
 * Guarantees at most one toast is displayed at a time and keeps persistent
 * warnings out of the bottom toast area so nothing overlaps at 1280x720. */
(function (G) {
  'use strict';
  /** @type {any} */
  const win = G;

  /** @type {HTMLElement | null} */
  let activeToast = null;
  /** @type {number} */
  let activeTimer = 0;

  /**
   * Show a single transient toast notification, replacing any prior toast cleanly.
   * @param {string} msg
   * @param {number} [ms]
   * @param {{ label: string, onClick: () => void }} [action]
   */
  function toast(msg, ms, action) {
    const host = document.getElementById('toasts');
    if (!host) return;
    if (activeTimer) { clearTimeout(activeTimer); activeTimer = 0; }
    if (activeToast) { activeToast.remove(); activeToast = null; }

    const el = document.createElement('div');
    el.className = 'toast' + (action && action.label ? ' has-action' : '');
    el.setAttribute('role', 'status');
    const dismiss = () => {
      if (/** @type {any} */ (el)._gone) return;
      /** @type {any} */ (el)._gone = true;
      if (activeTimer) { clearTimeout(activeTimer); activeTimer = 0; }
      el.style.transition = '.2s';
      el.style.opacity = '0';
      setTimeout(() => {
        el.remove();
        if (activeToast === el) activeToast = null;
      }, 210);
    };
    if (action && action.label && typeof action.onClick === 'function') {
      const span = document.createElement('span');
      span.textContent = msg;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn sm toast-action';
      btn.textContent = action.label;
      btn.onclick = () => { dismiss(); action.onClick(); };
      el.append(span, btn);
    } else {
      el.textContent = msg;
    }
    host.appendChild(el);
    activeToast = el;
    activeTimer = window.setTimeout(dismiss, ms || (action ? 6000 : 2600));
  }

  /** @type {HTMLElement | null} */
  let activePop = null;
  /** @type {HTMLElement | null} */
  let activeAnchor = null;

  function closeInfoPop() {
    if (activePop) { activePop.remove(); activePop = null; }
    if (activeAnchor) { activeAnchor.setAttribute('aria-expanded', 'false'); activeAnchor = null; }
  }

  /**
   * Open an on-demand ⓘ popover near an anchor button.
   * @param {HTMLElement} anchor
   */
  function openInfoPop(anchor) {
    if (activeAnchor === anchor && activePop) { closeInfoPop(); return; }
    closeInfoPop();
    const isEn = win.I18N && win.I18N.lang === 'en';
    const text = (isEn ? anchor.getAttribute('data-info-en') : anchor.getAttribute('data-info-zh'))
      || anchor.getAttribute('data-info') || '';
    if (!text) return;
    const pop = document.createElement('div');
    pop.className = 'info-pop';
    pop.setAttribute('role', 'tooltip');
    pop.textContent = text;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth || 280;
    const ph = pop.offsetHeight || 64;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12));
    const top = (r.bottom + 8 + ph < window.innerHeight - 12) ? (r.bottom + 8) : Math.max(12, r.top - ph - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    activePop = pop;
    activeAnchor = anchor;
  }

  document.addEventListener('click', e => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const btn = target && target.closest ? /** @type {HTMLElement | null} */ (target.closest('.info-btn')) : null;
    if (btn) { e.preventDefault(); e.stopPropagation(); openInfoPop(btn); return; }
    if (activePop && target && !activePop.contains(target)) closeInfoPop();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfoPop(); });
  window.addEventListener('resize', closeInfoPop);

  win.Notify = { toast, openInfoPop, closeInfoPop };
})(window);
