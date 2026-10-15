/**
 * InvoiceRepo.js — تنها نقطه‌ای که کد UI (html8.html) برای خواندن/نوشتن
 * فاکتور با دیتابیس صحبت می‌کند (Repository Pattern، بخش ۳ نقشه‌راه).
 *
 * امضای متدها دقیقاً هم‌راستا با نسخه‌ی نهایی مستندشده در roadmap-infinite-records-v4.md
 * (بعد از رفع ریسک ۲.۵) است: getPage/getStatusCounts با monthStart/monthEnd
 * ISO کار می‌کنند، نه یک sortVal شمسی خام.
 */

import { getDb } from './connection.js';
import { InvoiceRepoAdditions } from './InvoiceRepo.additions.js';

/**
 * یک عبارت WHERE مشترک برای getPage/getStatusCounts می‌سازد — هر دو باید
 * دقیقاً همان فیلترها (بازه‌ی تاریخ/مشتری/جستجو) را اعمال کنند تا شمارش
 * دکمه‌های وضعیت با لیست واقعی فاکتورها هم‌خوان بماند.
 */
function buildWhere({ monthStart, monthEnd, exactDate, customerId, search }) {
  const clauses = [];
  const params = [];

  if (exactDate) {
    clauses.push(`date(date) = date(?)`);
    params.push(exactDate);
  } else if (monthStart && monthEnd) {
    clauses.push(`date >= ? AND date < ?`);
    params.push(monthStart, monthEnd);
  }

  if (customerId != null && customerId !== '') {
    clauses.push(`customerId = ?`);
    params.push(customerId);
  }

  if (search) {
    clauses.push(`LOWER(customerName) LIKE ?`);
    params.push(`%${String(search).toLowerCase()}%`);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function rowToInvoice(row) {
  // ستون data شامل شیء کامل فاکتور (items[] و هر فیلد دیگر) است؛ ستون‌های
  // مجزا (status/sent/...) فقط برای فیلتر/ایندکس نگه داشته می‌شوند و همیشه
  // باید با آنچه داخل data ذخیره شده یکی باشند (چون InvoiceRepo.save هر دو
  // را هم‌زمان از روی همان invoice می‌نویسد).
  try {
    return JSON.parse(row.data);
  } catch {
    // اگر به هر دلیل data خراب/خالی بود، حداقل ستون‌های مجزا را برگردان
    // تا رندر کارت کاملاً نشکند.
    return { ...row };
  }
}

export const InvoiceRepo = {
  /**
   * صفحه‌بندی واقعی با LIMIT/OFFSET در SQL (نه slice روی آرایه).
   * @returns {Promise<{items: any[], total: number}>}
   */
  async getPage({ monthStart, monthEnd, exactDate, status, customerId, search, limit = 50, offset = 0 } = {}) {
    const db = await getDb();
    const { sql: whereBase, params: whereParams } = buildWhere({ monthStart, monthEnd, exactDate, customerId, search });

    let where = whereBase;
    const params = whereParams.slice();
    if (status === 'debtor') {
      where = where ? `${where} AND sent = 1 AND status != 'paid'` : `WHERE sent = 1 AND status != 'paid'`;
    } else if (status) {
      // «غیر بدهکار» یعنی وضعیت‌های draft/partial باید sent=0 باشند تا با
      // isInvoiceDebtor در html8.html هم‌خوان بمانند (paid هیچ‌وقت بدهکار نیست).
      const notDebtorClause = status === 'paid' ? `status = ?` : `status = ? AND sent = 0`;
      where = where ? `${where} AND ${notDebtorClause}` : `WHERE ${notDebtorClause}`;
      params.push(status);
    }

    const totalRes = await db.query(`SELECT COUNT(*) AS c FROM invoices ${where}`, params);
    const total = Number(totalRes?.values?.[0]?.c || 0);

    const pageRes = await db.query(
      `SELECT * FROM invoices ${where} ORDER BY date DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const items = (pageRes?.values || []).map(rowToInvoice);
    return { items, total };
  },

  /**
   * شمارش هر ۴ وضعیت (draft/partial/paid/debtor) هم‌زمان، بدون پارامتر status —
   * چون UI باید هر ۴ عدد را روی دکمه‌های فیلتر نشان دهد صرف‌نظر از این‌که
   * کدام دکمه فعلاً فعال است.
   */
  async getStatusCounts({ monthStart, monthEnd, exactDate, customerId, search } = {}) {
    const db = await getDb();
    const { sql: where, params } = buildWhere({ monthStart, monthEnd, exactDate, customerId, search });
    const sql = `
      SELECT
        SUM(CASE WHEN status='draft'   AND sent=0 THEN 1 ELSE 0 END) AS draft,
        SUM(CASE WHEN status='partial' AND sent=0 THEN 1 ELSE 0 END) AS partial,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN sent=1 AND status!='paid' THEN 1 ELSE 0 END) AS debtor
      FROM invoices ${where}
    `;
    const res = await db.query(sql, params);
    const row = res?.values?.[0] || {};
    return {
      draft: Number(row.draft || 0),
      partial: Number(row.partial || 0),
      paid: Number(row.paid || 0),
      debtor: Number(row.debtor || 0)
    };
  },

  /**
   * جمع تعداد/گردش‌مالی/سود در یک بازه‌ی تاریخ (فاز ۴ از این استفاده می‌کند؛
   * فاز ۱ فقط امضایش را مستند کرده بود).
   *
   * ✅ رفع باگ نسخه‌ی ۴.۱۹: نسخه‌ی قبلی این متد `json_extract(data,'$.totalTurnover')`
   * و `'$.totalProfit')` را جمع می‌زد — ولی این دو فیلد در ساختار واقعی فاکتور
   * (نگاه کن به `calcInvoiceTurnover`/`calcInvoiceProfit` در html8.html) هرگز روی
   * خودِ شیء فاکتور ذخیره نمی‌شوند؛ آن‌ها هر بار از روی آرایه‌ی `items[]` (فیلدهای
   * `lineTotal`/`itemProfit` هر آیتم) در سمت JS جمع زده می‌شوند. یعنی این متد از
   * روز اول (فاز ۱، فقط به‌عنوان امضا مستند شده بود) همیشه ۰ برمی‌گرداند — چون هیچ‌
   * کجا صدا زده نشده بود، این باگ تا امروز آشکار نشده بود. رفع شد با `json_each` روی
   * `data->'$.items'` تا واقعاً همان جمعی را بزند که `calcInvoiceTurnover`/`calcInvoiceProfit`
   * در JS می‌زنند.
   */
  async getTotalsByRange(start, end) {
    const db = await getDb();
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM invoices WHERE date >= ? AND date < ?) AS count,
        COALESCE((
          SELECT SUM(json_extract(je.value,'$.lineTotal'))
          FROM invoices i, json_each(i.data,'$.items') je
          WHERE i.date >= ? AND i.date < ?
        ),0) AS turnover,
        COALESCE((
          SELECT SUM(json_extract(je.value,'$.itemProfit'))
          FROM invoices i, json_each(i.data,'$.items') je
          WHERE i.date >= ? AND i.date < ?
        ),0) AS profit
    `;
    const res = await db.query(sql, [start, end, start, end, start, end]);
    const row = res?.values?.[0] || {};
    return { count: Number(row.count || 0), turnover: Number(row.turnover || 0), profit: Number(row.profit || 0) };
  },

  /**
   * جمع تعداد/گردش‌مالی/سود برای چند بازه‌ی تاریخ هم‌زمان (فاز ۴، اقدام ۱ —
   * جایگزین حلقه‌ی JS در `computeStatsData`/`html8.html` که روی کل آرایه‌ی
   * `invoices[]` اجرا می‌شد). هر بازه یک کوئری مستقل است (نه یک UNION غول‌پیکر)
   * چون تعداد بازه‌ها همیشه کم است (۵ تا ۱۲ تا، طبق `getStatsBuckets` در
   * html8.html) و سادگی/قابل‌اعتماد‌بودن روی سرعت میکروثانیه‌ای ترجیح داده شد —
   * همان تصمیمی که برای `getTotalsByRange` بالا هم گرفته شده.
   * @param {{start:string,end:string,label:string}[]} buckets - start/end باید رشته‌ی ISO باشند (همان قرارداد monthStart/monthEnd بقیه‌ی متدها)
   * @returns {Promise<{label:string,turnover:number,profit:number,count:number}[]>}
   */
  async getStatsBuckets(buckets = []) {
    if (!buckets.length) return [];
    const out = [];
    for (const b of buckets) {
      const totals = await InvoiceRepo.getTotalsByRange(b.start, b.end);
      out.push({ label: b.label, turnover: totals.turnover, profit: totals.profit, count: totals.count });
    }
    return out;
  },

  /**
   * سه «رکورددار» یک بازه (فاز ۴، ادامه‌ی اقدام ۱ — نسخه‌ی ۴.۲۰): پرفروش‌ترین
   * کارتن (بر اساس مجموع `cartonQty`)، مشتری با بیشترین گردش‌مالی (`lineTotal`)،
   * مشتری با بیشترین سود (`itemProfit`) — جایگزین حلقه‌ی JS در
   * `computeStatsLeaders`/`html8.html` که روی کل `invoices[]` اجرا می‌شد.
   *
   * **تقسیم مسئولیت عمدی:** این متد فقط Aggregation خام SQL را برمی‌گرداند
   * (نام کارتن/ابعاد/لایه‌ی خام، نه برچسب فارسی نهایی) — ساخت متن نمایشی
   * (`layerLabel`, فرمت ابعاد `L×W×H`) در `html8.html` (`fetchStatsLeaders`)
   * باقی می‌ماند، چون آن منطق کاملاً UI/i18n است، نه داده. همان تفکیکی که در
   * بقیه‌ی این فایل هم رعایت شده (Repo فقط SQL/داده، html8.html فرمت/رندر).
   *
   * **محدودیت آگاهانه:** برخلاف نسخه‌ی JS (که برای مشتری بدون customerId به
   * customerName بازمی‌گردد)، اینجا همیشه روی `customerId` گروه‌بندی می‌شود —
   * چون `invoices.customerId` در schema فاز ۱ `NOT NULL` است (نگاه کن به
   * `schema.js`)، این افتراق فقط در داده‌ی migrate‌شده/خراب با customerId
   * placeholder می‌تواند فرق کند، نه در مسیر عادی نوشتن.
   * @returns {Promise<{topCarton:object|null, topBuyer:object|null, topProfitCustomer:object|null}>}
   */
  async getStatsLeaders(start, end) {
    const db = await getDb();

    const cartonRes = await db.query(`
      SELECT
        json_extract(je.value,'$.cartonName') AS cartonName,
        json_extract(je.value,'$.cartonLength') AS cartonLength,
        json_extract(je.value,'$.cartonWidth') AS cartonWidth,
        json_extract(je.value,'$.cartonHeight') AS cartonHeight,
        json_extract(je.value,'$.layer') AS layer,
        SUM(COALESCE(json_extract(je.value,'$.cartonQty'),0)) AS qty
      FROM invoices i, json_each(i.data,'$.items') je
      WHERE i.date >= ? AND i.date < ?
      GROUP BY cartonName, cartonLength, cartonWidth, cartonHeight, layer
      HAVING qty > 0
      ORDER BY qty DESC
      LIMIT 1
    `, [start, end]);
    const cartonRow = cartonRes?.values?.[0] || null;

    const buyerRes = await db.query(`
      SELECT i.customerId AS customerId, i.customerName AS name,
        SUM(COALESCE(json_extract(je.value,'$.lineTotal'),0)) AS turnover
      FROM invoices i, json_each(i.data,'$.items') je
      WHERE i.date >= ? AND i.date < ?
      GROUP BY i.customerId
      HAVING turnover != 0
      ORDER BY turnover DESC
      LIMIT 1
    `, [start, end]);
    const buyerRow = buyerRes?.values?.[0] || null;

    const profitRes = await db.query(`
      SELECT i.customerId AS customerId, i.customerName AS name,
        SUM(COALESCE(json_extract(je.value,'$.itemProfit'),0)) AS profit
      FROM invoices i, json_each(i.data,'$.items') je
      WHERE i.date >= ? AND i.date < ?
      GROUP BY i.customerId
      HAVING profit != 0
      ORDER BY profit DESC
      LIMIT 1
    `, [start, end]);
    const profitRow = profitRes?.values?.[0] || null;

    return {
      topCarton: cartonRow ? {
        cartonName: cartonRow.cartonName || null,
        cartonLength: cartonRow.cartonLength ?? null,
        cartonWidth: cartonRow.cartonWidth ?? null,
        cartonHeight: cartonRow.cartonHeight ?? null,
        layer: cartonRow.layer ?? null,
        qty: Number(cartonRow.qty || 0)
      } : null,
      topBuyer: buyerRow ? { customerId: buyerRow.customerId, name: buyerRow.name, turnover: Number(buyerRow.turnover || 0) } : null,
      topProfitCustomer: profitRow ? { customerId: profitRow.customerId, name: profitRow.name, profit: Number(profitRow.profit || 0) } : null
    };
  },

  async getById(id) {
    const db = await getDb();
    const res = await db.query(`SELECT * FROM invoices WHERE id = ?`, [id]);
    const row = res?.values?.[0];
    return row ? rowToInvoice(row) : null;
  },

  /**
   * درج فاکتور + کسر موجودی در یک تراکنش (فاز ۵). عمداً هنوز جای دیگری
   * صدا زده نمی‌شود — منطق موجودی هنوز سمت جاوااسکریپت (html8.html) است.
   * @param {object} invoice
   * @param {{itemId:any, qtyDelta:number}[]} stockDeductions
   */
  async insertWithStockUpdate(invoice, stockDeductions = []) {
    const db = await getDb();
    return db.withTransaction(async (tx) => {
      for (const d of stockDeductions) {
        await tx.run(`UPDATE inventory SET qty = qty - ? WHERE id = ?`, [d.qtyDelta, d.itemId]);
      }
      await InvoiceRepo.save(invoice, tx);
      return true;
    });
  },

  /** حذف فاکتور + بازگرداندن موجودی در یک تراکنش (فاز ۵). */
  async deleteWithStockRestore(id, stockRestorations = []) {
    const db = await getDb();
    return db.withTransaction(async (tx) => {
      for (const r of stockRestorations) {
        await tx.run(`UPDATE inventory SET qty = qty + ? WHERE id = ?`, [r.qtyDelta, r.itemId]);
      }
      await InvoiceRepo.remove(id, tx);
      return true;
    });
  },

  /** batch insert داخل یک تراکنش — برای مهاجرت اولیه و Restore بکاپ. */
  async bulkInsert(invoices = []) {
    if (!invoices.length) return 0;
    const db = await getDb();
    return db.withTransaction(async (tx) => {
      for (const inv of invoices) {
        await InvoiceRepo.save(inv, tx);
      }
      return invoices.length;
    });
  },

  /**
   * حذف کامل تمام ردیف‌های جدول invoices (نه DROP TABLE — schema/ایندکس‌ها
   * دست‌نخورده می‌مانند). برای `clearAllData`/`doRestore` در html8.html
   * (ریسک بخش ۶: این دو تابع قبلاً فقط IndexedDB را پاک می‌کردند، نه SQLite).
   * @returns {Promise<boolean>}
   */
  async clearAll() {
    const db = await getDb();
    await db.run(`DELETE FROM invoices`, []);
    return true;
  }
};

/**
 * ادغام ۴ متد کشف‌شده در ریزمرحله‌های ۲.۳/۲.۵ (save/remove/getMonthCount/
 * getAllDates) — طبق دستورالعمل ادغام داخل خود InvoiceRepo.additions.js.
 * save/remove اینجا یک آرگومان دوم اختیاری `dbOverride` هم می‌پذیرند تا
 * insertWithStockUpdate/deleteWithStockRestore بالا بتوانند همان اتصال
 * تراکنشی (tx) را به آن‌ها پاس بدهند به‌جای باز کردن یک اتصال جدید.
 */
const additions = InvoiceRepoAdditions(getDb);
Object.assign(InvoiceRepo, {
  async save(invoice, dbOverride) {
    if (!dbOverride) return additions.save(invoice);
    // نسخه‌ی درون‌تراکنشی: همان SQL additions.save را با اتصال tx اجرا می‌کند.
    return InvoiceRepoAdditions(async () => dbOverride).save(invoice);
  },
  async remove(id, dbOverride) {
    if (!dbOverride) return additions.remove(id);
    return InvoiceRepoAdditions(async () => dbOverride).remove(id);
  },
  getMonthCount: additions.getMonthCount,
  getAllDates: additions.getAllDates
});

export default InvoiceRepo;
