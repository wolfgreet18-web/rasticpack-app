import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www/fonts', { recursive: true });

await build({ entryPoints: ['entry.js'], bundle: true, format: 'esm', outfile: 'www/db-bundle.js', minify: true, target: 'es2020', logLevel: 'info' });

// فونت‌ها به‌صورت محلی (برای کار آفلاین)
let fontCss = '';
const vz = 'node_modules/vazirmatn/fonts/webfonts';
if (fs.existsSync(vz)) {
  const f = fs.readdirSync(vz).find(n => /Vazirmatn\[wght\]\.woff2$/.test(n));
  if (f) {
    fs.copyFileSync(path.join(vz, f), 'www/fonts/Vazirmatn.woff2');
    fontCss += `@font-face{font-family:'Vazirmatn';font-weight:100 900;font-display:swap;src:url(fonts/Vazirmatn.woff2) format('woff2')}`;
  }
}
const gv = 'node_modules/@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2';
if (fs.existsSync(gv)) {
  fs.copyFileSync(gv, 'www/fonts/GreatVibes.woff2');
  fontCss += `@font-face{font-family:'Great Vibes';font-weight:400;font-display:swap;src:url(fonts/GreatVibes.woff2) format('woff2')}`;
}
if (!fontCss) console.warn('⚠ فونت محلی پیدا نشد؛ از فونت سیستم استفاده می‌شود');

let html = fs.readFileSync('index.src.html', 'utf8');
html = html.replace(/<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
html = html.replace('</head>', `<style>${fontCss}</style></head>`);
html = html.replace("import('./rasticpack-capacitor/src/cache/InvoiceCache.js')", "import('./db-bundle.js')");
html = html.replace(/const \[\{ migrate \}, InvoiceRepo, CustomerRepo\] = await Promise\.all\(\[[\s\S]*?\]\);/,
  "const { migrate, InvoiceRepo, CustomerRepo } = await import('./db-bundle.js');");
fs.writeFileSync('www/index.html', html);
console.log('✓ www/index.html ساخته شد');
