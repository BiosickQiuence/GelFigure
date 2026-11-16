import { chromium, firefox, webkit } from 'playwright';
import { perspectiveChecks } from './perspective.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
let ok = true;
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : ['chromium', 'firefox', 'webkit']) {
  const browser = await ({ chromium, firefox, webkit }[name]).launch();
  try {
    const results = await perspectiveChecks(browser, 'http://127.0.0.1:8765', root, name + '-final-' + Date.now());
    for (const r of results) console.log(name, ...r);
    ok &&= results.every(r => r[0] === 'ok');
  } finally { await browser.close(); }
}
process.exitCode = ok ? 0 : 1;
