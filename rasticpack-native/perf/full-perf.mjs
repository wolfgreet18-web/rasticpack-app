import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/package.json');
const { chromium } = require('playwright');

const HTML = process.argv[2];
const SCEN = process.argv[3].split(',').map(s => { const [c, i, m, k] = s.split(':'); return { C: +c, I: +i, M: +m, K: k === 'k' }; });
const THR = process.argv[4].split(',').map(Number);
const TO = 400000;

const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });

async function seed(page, C, I, M) {
  return page.evaluate(async ([C, I, M]) => {
    const t0 = performance.now();
    const first = ['محمد','علی','رضا','حسین','مهدی','احمد','سعید','حمید','محسن','امیر','مریم','زهرا','فاطمه','سارا','نرگس'];
    const last = ['رضایی','احمدی','حسینی','کریمی','موسوی','جعفری','رستمی','صادقی','قاسمی','نوری','زارعی','اکبری','یزدانی','طاهری','سلیمانی'];
    const comp = ['بازرگانی','صنایع غذایی','پخش','تولیدی','لوازم خانگی','فروشگاه','چاپ و بسته‌بندی'];
    const nameOf = i => first[i % 15] + ' ' + last[(i * 7) % 15] + ' ' + i;
    const db = await new Promise((res, rej) => { const r = indexedDB.open('rasticpackDB', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const put = (store, arr) => new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); const os = tx.objectStore(store); for (const x of arr) os.put(x); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    const CH = 20000;
    for (let s = 1; s <= C; s += CH) {
      const arr = [];
      for (let i = s; i < s + CH && i <= C; i++) arr.push({ id: i, name: nameOf(i), company: i % 2 ? comp[i % 7] + ' ' + last[(i * 3) % 15] : '',
        address: 'مشهد، بلوار وکیل‌آباد، خیابان ' + (i % 90) + '، پلاک ' + (i % 200), phone: '0915' + String(1000000 + (i * 37) % 8999999),
        lat: i % 2 ? 36.3 + (i % 100) / 1000 : null, lng: i % 2 ? 59.5 + (i % 100) / 1000 : null, locationLink: null });
      await put('customers', arr);
    }
    const now = Date.now(); const st = ['draft', 'partial', 'paid'];
    const _n = new Date(); const jd = gregorianToJalali(_n.getFullYear(), _n.getMonth() + 1, _n.getDate())[2];
    for (let s = 1; s <= I; s += CH) {
      const arr = [];
      for (let i = s; i < s + CH && i <= I; i++) {
        const cid = 1 + ((i * 2654435761) >>> 0) % C;
        const n = 1 + (i % 4);
        const items = [];
        for (let k = 0; k < n; k++) {
          const qty = 50 + ((i * (k + 3)) % 950), unit = 8000 + ((i + k * 13) % 40) * 500;
          items.push({ sheetId: 1 + (k % 5), sh: 100 + (k * 10), sw: 70, qty, layer: k % 2 ? '5' : '3', cartonName: 'کارتن ' + (1 + ((i + k) % 30)),
            cartonLength: 30 + (i % 20), cartonWidth: 20 + (k * 3), cartonHeight: 15 + (i % 10), cartonQty: qty * 2, unitPrice: unit, lineTotal: qty * unit, itemProfit: Math.round(qty * unit * 0.18), stockAfter: 500 });
        }
        arr.push({ id: i, customerId: cid, customerName: nameOf(cid), date: new Date(now - (i <= M ? (((i * 31) % jd) * 864e5 + (i % 3600) * 1000) : ((jd + (i * 7919) % 1095) * 864e5 + (i % 86400) * 1000))).toISOString(), type: 'final',
          status: st[i % 3], sent: i % 5 < 2, items, totalSheets: items.reduce((a, b) => a + b.qty, 0), paidAmount: (i % 3 === 1) ? 1000000 : 0 });
      }
      await put('invoices', arr);
    }
    db.close();
    return Math.round(performance.now() - t0);
  }, [C, I, M]);
}

const waitReady = (page) => page.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return o && o.style.display === 'none'; }, null, { timeout: TO, polling: 50 });

const scrollTest = (page, label) => page.evaluate(async (label) => {
  window.scrollTo(0, 0);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const ts = [];
  await new Promise(res => { let n = 0; const f = t => { ts.push(t); window.scrollBy(0, 60); if (++n < 90) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]); d.sort((a, b) => a - b);
  return { med: Math.round(d[d.length >> 1]), p95: Math.round(d[Math.floor(d.length * .95)]), max: Math.round(d[d.length - 1]), missedPct: Math.round(100 * d.filter(x => x > 25).length / d.length) };
}, label);

for (const sc of SCEN) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  await ctx.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  const page = await ctx.newPage();
  const errors = new Set();
  page.on('pageerror', e => errors.add(String(e.message).slice(0, 100)));
  await page.goto('file://' + HTML, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const seedMs = await seed(page, sc.C, sc.I, sc.M);
  const cdp = await ctx.newCDPSession(page);
  for (const thr of THR) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
    const out = { C: sc.C, I: sc.I, M: sc.M, throttle: thr };
    if (thr === THR[0]) out.seedMs = seedMs;
    try {
      const t0 = Date.now();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitReady(page);
      out.loadMs = Date.now() - t0;
      await page.waitForTimeout(300);
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      const hu = await cdp.send('Runtime.getHeapUsage');
      out.heapMB = Math.round(hu.usedSize / 1048576);
      out.counts = await page.evaluate(() => [customers.length, invoices.length]);

      out.heavyFns = await page.evaluate(() => { const t = f => { const s = performance.now(); try { f(); } catch (e) { return 'err'; } return Math.round(performance.now() - s); }; return { invFilterOptions: t(() => renderInvoicesFilterOptions()), customerDatalist: t(() => renderCustomerDatalist()) }; });
      // تب فاکتورها
      out.inv = await page.evaluate(async () => {
        const med = a => { a.sort((x, y) => x - y); return Math.round(a[a.length >> 1]); };
        const btn = document.querySelector(`.tab-btn[onclick*="switchTab('invoices'"]`);
        const t = performance.now(); switchTab('invoices', btn); await renderInvoicesList(); const first = Math.round(performance.now() - t);
        const inp = document.getElementById('inv-search-input');
        const run = async q => { if (inp) inp.value = q; const s = performance.now(); await renderInvoicesList(); return performance.now() - s; };
        const reps = async q => { const a = []; for (let i = 0; i < 3; i++) a.push(await run(q)); return med(a); };
        const plain = await reps('');
        const search = await reps('رستمی');
        if (inp) inp.value = '';
        await renderInvoicesList();
        const h = document.documentElement.scrollHeight;
        window.scrollTo(0, 1e9); await new Promise(r => setTimeout(r, 200));
        const reach = Math.round(window.scrollY + window.innerHeight);
        window.scrollTo(0, 0);
        return { first, plain, search, pageHeightPx: h, reachablePx: reach };
      });
      out.invScroll = await scrollTest(page, 'inv');

      // تب مشتری‌ها
      out.cust = await page.evaluate(async () => {
        const med = a => { a.sort((x, y) => x - y); return Math.round(a[a.length >> 1] * 10) / 10; };
        switchTab('customers', document.querySelector(`.tab-btn[onclick*="switchTab('customers'"]`));
        const inp = document.getElementById('cust-search');
        const run = q => { inp.value = q; const s = performance.now(); renderCustomersList(); return performance.now() - s; };
        const reps = q => { const a = []; for (let i = 0; i < 3; i++) a.push(run(q)); return med(a); };
        const r = { all: reps(''), search: reps('محمد'), searchRare: reps('رستمی 99') }; inp.value = ''; renderCustomersList(); return r;
      });
      out.custScroll50 = await scrollTest(page, 'cust50');

      // آمار
      out.stats = await page.evaluate(async () => {
        const r = {};
        for (const p of ['week', 'year']) { statsPeriod = p; const s = performance.now(); try { renderStatsCharts(); } catch (e) { r.err = String(e.message).slice(0, 60); } r[p] = Math.round(performance.now() - s); }
        return r;
      });

      // لیست مشتری بدون مجازی‌سازی: چند کارت در DOM
      if (sc.K) {
        out.custK = {};
        for (const K of [50, 200, 500, 1000, 2000]) {
          const t = await page.evaluate(K => { switchTab('customers', document.querySelector(`.tab-btn[onclick*="switchTab('customers'"]`)); document.getElementById('cust-search').value = ''; custRenderLimit = K; const s = performance.now(); renderCustomersList(); return Math.round(performance.now() - s); }, K);
          const sc2 = await scrollTest(page, 'custK');
          out.custK[K] = { renderMs: t, ...sc2 };
        }
      }
    } catch (e) { out.error = String(e.message).slice(0, 160); }
    out.errors = [...errors].slice(0, 2);
    console.log(JSON.stringify(out));
  }
  await ctx.close();
}
await browser.close();
