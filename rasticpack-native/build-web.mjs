import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www/fonts', { recursive: true });

await build({ entryPoints: ['entry.js'], bundle: true, format: 'esm', outfile: 'www/db-bundle.js', minify: true, target: 'es2020', logLevel: 'info' });

// فونت‌های محلی (کار آفلاین): یک نسخه با آدرس فایل برای صفحه‌ی اصلی، یک نسخه base64 برای سند چاپ فاکتور
const fonts = [];
const vz = 'node_modules/vazirmatn/fonts/webfonts';
if (fs.existsSync(vz)) {
  const f = fs.readdirSync(vz).find(n => /Vazirmatn\[wght\]\.woff2$/.test(n));
  if (f) { fs.copyFileSync(path.join(vz, f), 'www/fonts/Vazirmatn.woff2'); fonts.push({ family: 'Vazirmatn', file: 'fonts/Vazirmatn.woff2', weight: '100 900' }); }
}
const gv = 'node_modules/@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2';
if (fs.existsSync(gv)) { fs.copyFileSync(gv, 'www/fonts/GreatVibes.woff2'); fonts.push({ family: 'Great Vibes', file: 'fonts/GreatVibes.woff2', weight: '400' }); }
if (!fonts.length) console.warn('⚠ فونت محلی پیدا نشد؛ از فونت سیستم استفاده می‌شود');

const css = (urlOf) => fonts.map(f => `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-display:swap;src:url(${urlOf(f)}) format('woff2')}`).join('');
const fileCss = css(f => f.file);
const dataCss = css(f => 'data:font/woff2;base64,' + fs.readFileSync('www/' + f.file).toString('base64'));

let html = fs.readFileSync('index.src.html', 'utf8');

// ۱) سند چاپ فاکتور (داخل رشته‌ی JS): لینک گوگل‌فونت → استایل محلی
html = html.replace(/<link[^>]*Great\+Vibes[^>]*>/g, () => '<style>${window.__RP_FONT_CSS||""}</style>');
// ۲) سربرگ صفحه‌ی اصلی: حذف لینک‌های گوگل‌فونت
html = html.replace(/<noscript>\s*<link[^>]*fonts\.googleapis\.com[^>]*>\s*<\/noscript>\s*/g, '');
html = html.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
html = html.replace('</head>', () => `<style>${fileCss}</style><script>window.__RP_FONT_CSS=${JSON.stringify(dataCss)};</script></head>`);

// ۳) ماژول‌های دیتابیس از باندل محلی
html = html.replace("import('./rasticpack-capacitor/src/cache/InvoiceCache.js')", "import('./db-bundle.js')");
const before = html;
html = html.replace(/const \[\{ migrate \}, InvoiceRepo, CustomerRepo\] = await Promise\.all\(\[[\s\S]*?\]\);/,
  "const { migrate, InvoiceRepo, CustomerRepo } = await import('./db-bundle.js');");
if (html === before || !html.includes("import('./db-bundle.js')")) throw new Error('الگوی import دیتابیس در HTML پیدا نشد');
if (/fonts\.googleapis\.com/.test(html)) console.warn('⚠ هنوز ارجاع به fonts.googleapis.com باقی مانده');

fs.writeFileSync('www/index.html', html);
console.log('✓ www/index.html ساخته شد', (html.length / 1024).toFixed(0) + 'KB');
