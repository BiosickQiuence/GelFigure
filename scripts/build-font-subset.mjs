/* Build a lightweight base64 WOFF2 Chinese serif subset for GelFigure headings (V2).
 * Extracts unique characters from UI headings + i18n/zh.json and subsets NotoSerifSC-VF.ttf. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = fileURLToPath(new URL('..', import.meta.url));
const outCss = path.join(root, 'css', 'heading-font.css');
const fontCandidates = [
  process.env.GELFIGURE_SERIF_FONT,
  'C:\\Windows\\Fonts\\NotoSerifSC-VF.ttf',
  '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
  '/System/Library/Fonts/Songti.ttc'
].filter(Boolean);

const HEADING_TEXT = [
  '把胶图变成可发表的实验图把胶图拖进来选择一张胶图',
  '正在处理连接看图服务粘贴并测试选择服务商获取密钥隐私确认',
  '待核对清单校正命名与标注版式与导出高级',
  '使用说明快捷键帮助历史项目设置中心灰度定量批量处理样本表',
  '拖入胶图或点击选择体验示例本地处理离线打开项目',
  '开始使用重放步新手引导觉得好用点个导出就绪度',
  'GelFigure 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz·—/()（）:：，。、？！'
].join('');

function collectChars() {
  const set = new Set([...HEADING_TEXT]);
  try {
    const zh = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'zh.json'), 'utf8'));
    for (const v of Object.values(zh)) for (const ch of String(v)) set.add(ch);
  } catch (_) {}
  return [...set].join('');
}

async function main() {
  const fontPath = fontCandidates.find(p => fs.existsSync(p));
  if (!fontPath) {
    console.log('[build-font-subset] No local NotoSerifSC font found; keeping fallback serif stack.');
    fs.writeFileSync(outCss, '/* Fallback serif stack (no local NotoSerifSC font available at build time) */\n');
    return;
  }
  const text = collectChars();
  const srcBuf = fs.readFileSync(fontPath);
  const woff2 = await subsetFont(srcBuf, text, { targetFormat: 'woff2' });
  const b64 = Buffer.from(woff2).toString('base64');
  const css = [
    `/* Auto-generated Chinese serif heading subset (${text.length} glyphs, ${(woff2.byteLength / 1024).toFixed(1)} KB WOFF2) */`,
    `@font-face {`,
    `  font-family: "GelFigure Serif";`,
    `  font-style: normal;`,
    `  font-weight: 400 700;`,
    `  font-display: swap;`,
    `  src: url("data:font/woff2;base64,${b64}") format("woff2");`,
    `}\n`
  ].join('\n');
  fs.writeFileSync(outCss, css);
  console.log(`[build-font-subset] Wrote css/heading-font.css (${text.length} glyphs, ${(woff2.byteLength / 1024).toFixed(1)} KB WOFF2)`);
}

main().catch(err => { console.error(err); process.exit(1); });
