/* Interface language (Chinese / English). Strings stay next to the code that uses them:
 *   JS:   L('中文', 'English')                       — evaluated at call time, so re-rendering switches language
 *   HTML: <span data-en="English">中文</span>         — text
 *         data-en-html / data-en-title / data-en-placeholder for markup and attributes
 * The figure itself is always English (journal convention); only the interface is translated. */
(function (G) {
  'use strict';
  const KEY = 'gelfig.lang';
  const fromUrl = new URLSearchParams(location.search).get('lang');
  const savedLang = G.PrefStorage.getItem(KEY);
  let lang = fromUrl === 'en' || fromUrl === 'zh' ? fromUrl
    : (savedLang === 'en' || savedLang === 'zh' ? savedLang : (/^zh\b/i.test(navigator.language || '') ? 'zh' : 'en'));
  const listeners = [];
  /** @type {{ zh: Record<string, string>, en: Record<string, string> }} */
  const dict = Object.assign({ zh: {}, en: {} }, /** @type {any} */ (G).GelFigureI18N || {});

  const L = (zh, en) => (lang === 'en' ? en : zh);

  /**
   * Look up a key from i18n/zh.json or i18n/en.json with optional {var} interpolation.
   * @param {string} key
   * @param {Record<string, string | number>} [vars]
   */
  function t(key, vars) {
    const raw = (dict[lang] && dict[lang][key]) || dict.zh[key] || dict.en[key] || '';
    if (!vars || !raw) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  }

  /** @param {'zh' | 'en'} l @param {Record<string, string>} entries */
  function register(l, entries) {
    if ((l === 'zh' || l === 'en') && entries) Object.assign(dict[l], entries);
  }

  // swap one kind of content, remembering the Chinese original the first time
  function swap(el, enAttr, zhAttr, get, set) {
    if (!el.hasAttribute(enAttr)) return;
    if (!el.hasAttribute(zhAttr)) el.setAttribute(zhAttr, get());
    set(lang === 'en' ? el.getAttribute(enAttr) : el.getAttribute(zhAttr));
  }
  function apply(root) {
    (root || document).querySelectorAll('[data-en],[data-en-html],[data-en-title],[data-en-placeholder]').forEach(el => {
      swap(el, 'data-en', 'data-zh', () => el.textContent, v => { el.textContent = v; });
      swap(el, 'data-en-html', 'data-zh-html', () => el.innerHTML, v => { el.innerHTML = v; });
      swap(el, 'data-en-title', 'data-zh-title', () => el.title, v => { el.title = v; });
      swap(el, 'data-en-placeholder', 'data-zh-placeholder', () => el.placeholder, v => { el.placeholder = v; });
    });
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    const b = document.getElementById('btnLang');
    if (b) {
      const label = b.querySelector('.lang-label');
      const next = lang === 'en' ? '中文' : 'EN';
      if (label) label.textContent = next;
      else b.textContent = next;
      b.title = lang === 'en' ? '切换到中文' : 'Switch to English';
    }
  }
  function set(l) {
    if (l !== 'en' && l !== 'zh') return;
    lang = l;
    G.PrefStorage.setItem(KEY, l);
    apply();
    listeners.forEach(fn => fn(l));
  }

  // Opportunistically load i18n/*.json when running over http/https (inlined in singlefile builds)
  if (typeof fetch === 'function' && /^https?:/.test(location.protocol) && !Object.keys(dict.zh).length) {
    Promise.all([
      fetch('i18n/zh.json').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('i18n/en.json').then(r => r.ok ? r.json() : null).catch(() => null)
    ]).then(([zh, en]) => {
      if (zh) register('zh', zh);
      if (en) register('en', en);
    });
  }

  G.I18N = { L, t, register, apply, set, get lang() { return lang; }, onChange: fn => listeners.push(fn) };
  G.L = L;
  apply();   // loaded at the end of <body>: the static page is already parsed
})(window);
