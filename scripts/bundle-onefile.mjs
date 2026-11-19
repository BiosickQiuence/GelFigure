/* Build GelFigure.html: a single file with every JS and CSS inlined, so it runs by double-click.
 * The app itself does not change: the bundled scripts keep their load order and page structure. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUpdates } from './check-updates.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const indexPath = path.join(root, 'index.html');
const outPath = path.join(root, 'dist', 'GelFigure.html');
checkUpdates(root);

const read = p => fs.readFileSync(p, 'utf8');
let html = read(indexPath);
const supportSource=read(path.join(root,'js/support-config.js')),configMarker='window.GelFigureSupport = ';
const supportConfig=JSON.parse(supportSource.slice(supportSource.indexOf(configMarker)+configMarker.length).trim().replace(/;$/,''));
const expectedConnect="connect-src 'self' file: data: blob: https:;";
const csp=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
if(!csp||!csp[1].includes(expectedConnect))throw new Error('AI trial requires HTTPS connect-src for user-configured endpoints');

// inline css in explicit cascade order
const cssOrder = ['tokens.css', 'heading-font.css', 'style.css', 'components.css', 'marker-ai.css', 'gel-ai-beta.css', 'workspace.css', 'v13-ai.css', 'v14-layout.css'];
const allCss = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css'));
const cssFiles = [
  ...cssOrder.filter(f => allCss.includes(f)),
  ...allCss.filter(f => !cssOrder.includes(f)).sort((a, b) => a.localeCompare(b))
];
let style = '';
for (const f of cssFiles) style += `/* css/${f} */\n` + read(path.join(root, 'css', f)) + '\n';
let cssInlined=false;
html = html.replace(/<link rel="stylesheet" href="css\/[^"]+"\s*\/?>/g, () => {if(cssInlined)return '';cssInlined=true;return `<style>\n${style}\n</style>`;});

// inline i18n JSON dictionaries so single-file offline mode has complete dictionary strings
const i18nZh = JSON.parse(read(path.join(root, 'i18n', 'zh.json')));
const i18nEn = JSON.parse(read(path.join(root, 'i18n', 'en.json')));
const i18nBundle = `window.GelFigureI18N=${JSON.stringify({ zh: i18nZh, en: i18nEn })};`;

// inline scripts in the same order as index.html
// script order must match index.html exactly
for (const f of ['storage', 'i18n', 'notifications', 'tiff', 'colour', 'ladder-cache', 'ladders', 'engine', 'name-text', 'render', 'export', 'pptx', 'demo', 'app', 'library', 'editor', 'ui', 'figedit', 'mobile', 'perspective', 'marker-ui', 'ai-reliability', 'ai-client', 'ai-workspace', 'marker-ai', 'gel-ai-beta', 'auto-flow', 'ai-wizard', 'review-checklist', 'welcome-ai', 'layout-v14', 'history-ui', 'support-config', 'feedback', 'export-support', 'onboarding', 'help-ui']) {
  const code = read(path.join(root, 'js', f + '.js'));
  const prefix = f === 'i18n' ? i18nBundle + '\n' : '';
  const tag = new RegExp(`<script src="js/${f}\\.js"><\\/script>`, 'g');
  html = html.replace(tag, () => `<script>/* js/${f}.js */\n${prefix}${code}\n</script>`);
}
// a script added to index.html but not to the list above would silently be missing from the single file
const left = html.match(/<script src="js\/(?!uitest)[^"]+"><\/script>/g);
if (left) { console.error('not inlined:', left.join(' ')); process.exit(1); }

// test scripts (test/test.html loads uitest.js too): inline if present
if (html.includes('js/uitest.js')) {
  html = html.replace(/<script src="js\/uitest\.js"><\/script>/g, () => `<script>/* js/uitest.js */\n${read(path.join(root, 'js', 'uitest.js'))}\n</script>`);
}

// Single-file mode needs inline scripts. Preserve the exact feedback endpoint allowance, if any,
// rather than replacing the whole policy with a broader or stale one.
html = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]+)(">)/,(_,before,policy,after)=>before+policy.replace(/script-src ([^;]+);/,(_,sources)=>"script-src "+sources+" 'unsafe-inline';")+after);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
if(fs.existsSync(outPath)){
  const backupDir=path.resolve(root,'..','generated-backups');
  fs.mkdirSync(backupDir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup=path.join(backupDir,'GelFigure.html.'+stamp+'.backup');
  fs.copyFileSync(outPath,backup,fs.constants.COPYFILE_EXCL);
  const hash=buf=>createHash('sha256').update(buf).digest('hex');
  if(hash(fs.readFileSync(backup))!==hash(fs.readFileSync(outPath)))throw new Error('Bundle backup mismatch');
}
fs.writeFileSync(outPath, html);
console.log(`${outPath}  ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
