# Baseline performance — hrml27 (web logic, Chromium headless)

Date: 2026-10-17. Target phone: Honor X8 (Snapdragon 680, 6 GB RAM, 90 Hz).
NOT measured on a real phone. CPU throttling x4 (optimistic) and x8 (pessimistic) emulate a slower CPU.
Seeded IndexedDB (customers C, invoices I, M of them in the current Persian month), reloaded the app, measured.

## How to re-run (after improving the app)
    node perf/full-perf.mjs /abs/path/to/index.src.html 2000:10000:300,5000:30000:1000:k,10000:100000:3000,20000:200000:6000,50000:500000:20000 1,4,8
Needs playwright (see the createRequire path at the top of the script). Output: one JSON line per (scenario, throttle).
Compare against baseline-2026-10-17.jsonl. Run scenarios sequentially (2 CPU cores; parallel runs disturb timings).

## Findings (cost per action; x4 / x8)
- Re-render of invoice list (month change, search keystroke, after saving) is O(TOTAL invoices), not the month size: ~17 us/invoice (x4), ~36 us/invoice (x8).
  >0.3 s at ~17k (x4) / ~8k (x8) invoices; >1 s at ~55k (x4) / ~28k (x8).
- Saving an invoice runs renderInvoicesFilterOptions + list + customers: ~0.7 s at 15k (x4); ~1.3 s at 30k (x4).
- Stats tab (renderStatsCharts, sync): week/year 0.24/0.44 s at 15k invoices (x4); 0.78/1.6 s at 50k; 1.8/3.4 s at 100k.
- App open: 1.0 s (3k:15k, x4), 2.3 s (10k:50k), 3.2 s (10k:100k), 6.2 s (20k:200k), 16 s (50k:500k); x8 about 1.5-3x longer. Load numbers are noisy (+/-2x).
- Customer list is not virtualized: "show next 50" re-renders ALL cards. K cards in DOM: render 0.67 s @200, 1.5 s @500, 6.4 s @2000 (x4); scroll missed-frames 1% @200, 6% @500, 10% @1000, 100% @2000 (x4). x8: 11% @200, 21% @500, 99% @1000.
- Invoice list scroll (virtual list) stays smooth up to 500k invoices (1-4% missed frames, occasional 0.13-0.45 s hitches at x8 with big lists).
- JS heap after GC: 7 MB (10k inv), 52 MB (100k), 102 MB (200k), 253 MB (500k).
- SQLite paths in the HTML are inactive (window.__InvoiceRepo is the module namespace, methods undefined), so the app runs on in-memory arrays + IndexedDB.

## After optimisation (HTML-only changes) — 2026-10-17
Raw: `after-2026-10-17.jsonl`. Same harness/scenarios, CPU throttle x4 / x8 (ms, before -> after):

| scenario (inv) | list re-render x4 | list re-render x8 | filter options x4 | stats year x4 | stats year x8 |
|---|---|---|---|---|---|
| 10k  | 221 -> 53 | 397 -> 96 | 106 -> 0 | 272 -> 43 | 542 -> 75 |
| 30k  | 524 -> 70 | 1091 -> 130 | 475 -> 1 | 895 -> 141 | 1790 -> 254 |
| 100k | 1770 -> 177 | 3421 -> 362 | 1727 -> 0 | 3382 -> 405 | 5414 -> 967 |
| 200k | 3605 -> 252 | 7522 -> 664 | 1882 -> 1 | 6485 -> 770 | 13904 -> 1846 |

Customer list is now virtualised (createVirtualList); per-keystroke render incl. layout (5k/20k customers, x4): 358/265 -> 113/115 ms; x8: 489/606 -> 164/182 ms.
Note: `cust all` / `custK` numbers in the after file measure only synchronous JS (render is now async) — use `custrender` style timing (await a frame) for customer comparisons.
