/**
 * schema.js — تعریف جداول اصلی + ایندکس‌ها (فاز ۱ نقشه‌راه)
 * نسخه‌بندی‌شده با SCHEMA_VERSION برای migration‌های آینده.
 *
 * منبع: بخش ۴ / فاز ۱ سند roadmap-infinite-records-v4.md — این فایل دقیقاً
 * همان SQL مستندشده در آن سند است، به‌علاوه‌ی جداول کوچکِ نام‌برده‌شده
 * (inventory, van_drivers, production_queue, settings_kv, meta) که در سند
 * فقط با اسم اشاره شده بودند و شکل دقیق‌شان اینجا برای اولین‌بار نوشته شده
 * (بر مبنای معنایی که در html8.html استفاده می‌شوند — نگاه کن به یادداشت
 * هر جدول). این پنج جدول «بدون رشد نامحدود»اند طبق تعریف نقشه‌راه.
 */

export const SCHEMA_VERSION = 1;

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE,
    company TEXT, address TEXT, phone TEXT,
    lat REAL, lng REAL, locationLink TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cust_name  ON customers(name)`,
  `CREATE INDEX IF NOT EXISTS idx_cust_phone ON customers(phone)`,

  `CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY,
    customerId INTEGER NOT NULL,
    customerName TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    sent INTEGER NOT NULL DEFAULT 0,
    sentToProduction INTEGER NOT NULL DEFAULT 0,
    paidAmount REAL,
    totalSheets INTEGER NOT NULL DEFAULT 0,
    editedAt TEXT,
    data TEXT NOT NULL,
    FOREIGN KEY(customerId) REFERENCES customers(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inv_cust        ON invoices(customerId)`,
  `CREATE INDEX IF NOT EXISTS idx_inv_date        ON invoices(date)`,
  `CREATE INDEX IF NOT EXISTS idx_inv_status      ON invoices(status)`,
  `CREATE INDEX IF NOT EXISTS idx_inv_sent        ON invoices(sent)`,
  `CREATE INDEX IF NOT EXISTS idx_inv_cust_date   ON invoices(customerId, date)`,
  `CREATE INDEX IF NOT EXISTS idx_inv_status_date ON invoices(status, date)`,
  // ایندکس پوششی (covering index) برای InvoiceRepo.getStatusCounts وقتی فقط
  // بازه‌ی تاریخ فیلتر می‌شود (بدون customerId) — طبق ریسک کشف‌شده در نسخه‌ی
  // ۴.۴ نقشه‌راه (بخش ۶): روی ۱M رکورد این کوئری ۴۱-۴۵ms طول می‌کشید، خیلی
  // نزدیک به آستانه‌ی ۵۰ms. چون SELECT فقط به date/status/sent نیاز دارد (نه
  // ستون‌های دیگر جدول)، این ایندکس اجازه می‌دهد SQLite کل کوئری را از روی
  // خودِ ایندکس جواب بدهد (index-only scan) بدون رفتن سراغ ردیف اصلی جدول.
  `CREATE INDEX IF NOT EXISTS idx_inv_date_status_sent ON invoices(date, status, sent)`,

  // جداول کوچک، «بدون رشد نامحدود» — شکل دقیق این پنج جدول در سند نقشه‌راه
  // مستند نشده بود؛ اینجا برای اولین بار به‌صورت حداقلی/عملی نوشته شدند تا
  // migrateFromIndexedDB و بقیه‌ی Repo ها بتوانند به آن‌ها تکیه کنند. اگر
  // شکل واقعی این جداول در پروژه‌ی اصلی جای دیگری تعریف شده، این تعاریف
  // باید با آن هم‌راستا/جایگزین شوند.
  `CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 0,
    unit TEXT,
    data TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS van_drivers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    data TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS production_queue (
    id INTEGER PRIMARY KEY,
    invoiceId INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT DEFAULT (datetime('now')),
    data TEXT
  )`,
  // key-value ساده برای پرچم‌های سیستمی مثل migrated_v1 (نگاه کن به migrateFromIndexedDB.js)
  `CREATE TABLE IF NOT EXISTS settings_kv (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  // متادیتای schema (نسخه‌ی فعلی) — برای migration های ساختاری آینده
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,

  // آماده برای فاز ۳ (جستجوی متنی) — این جدول از فاز ۱ تعریف شده بود ولی تا
  // نسخه‌ی ۴.۱۸ نه sync می‌شد و نه در CustomerRepo استفاده می‌شد (بی‌اثر/مرده).
  `CREATE VIRTUAL TABLE IF NOT EXISTS customers_fts USING fts5(
    name, company, content='customers', content_rowid='id'
  )`,

  // ✅ نسخه‌ی ۴.۱۸ — سه تریگر sync برای customers_fts (external-content FTS5
  // table): چون CustomerRepo با SQL خام روی جدول customers کار می‌کند (نه از
  // طریق یک API کنترل‌شده‌ی FTS)، بدون این تریگرها customers_fts بعد از اولین
  // backfill دیگر هیچ‌وقت به‌روز نمی‌شد و جستجو رفته‌رفته کهنه می‌شد. الگوی
  // استاندارد «external content table» طبق مستندات خودِ FTS5: هر ردیف تغییر
  // در customers، یک ردیف متناظر در customers_fts (با همان rowid=id) درج/حذف
  // می‌کند. برای UPDATE، ابتدا ردیف قدیمی با دستور ویژه‌ی 'delete' حذف می‌شود
  // (چون UPDATE مستقیم روی external-content FTS پشتیبانی نمی‌شود)، سپس ردیف
  // جدید درج می‌شود — دقیقاً الگویی که مستندات SQLite برای این حالت توصیه
  // می‌کند. `CustomerRepo.save` از `INSERT ... ON CONFLICT DO UPDATE` استفاده
  // می‌کند؛ SQLite برای upsert، بسته به این‌که conflict رخ داده یا نه، یا
  // تریگر INSERT یا تریگر UPDATE را آتش می‌زند (نه هر دو) — پس هیچ ردیفی دوبار
  // ایندکس نمی‌شود.
  `CREATE TRIGGER IF NOT EXISTS customers_fts_ai AFTER INSERT ON customers BEGIN
    INSERT INTO customers_fts(rowid, name, company) VALUES (new.id, new.name, new.company);
  END`,
  `CREATE TRIGGER IF NOT EXISTS customers_fts_ad AFTER DELETE ON customers BEGIN
    INSERT INTO customers_fts(customers_fts, rowid, name, company) VALUES('delete', old.id, old.name, old.company);
  END`,
  `CREATE TRIGGER IF NOT EXISTS customers_fts_au AFTER UPDATE ON customers BEGIN
    INSERT INTO customers_fts(customers_fts, rowid, name, company) VALUES('delete', old.id, old.name, old.company);
    INSERT INTO customers_fts(rowid, name, company) VALUES (new.id, new.name, new.company);
  END`
];

/**
 * بازسازی کامل customers_fts از روی جدول customers — فقط یک‌بار لازم است
 * (برای ردیف‌هایی که قبل از وجود تریگرهای بالا درج شده بودند؛ ردیف‌های بعدی
 * را خودِ تریگرها به‌روز نگه می‌دارند). idempotent با پرچم settings_kv
 * ('fts_customers_built_v1') — دوباره صدا زدن بی‌اثر و ارزان است (فقط یک
 * SELECT از settings_kv، نه یک rebuild واقعی دوباره).
 * @param {{run:(sql:string, params?:any[])=>Promise<any>, query:(sql:string, params?:any[])=>Promise<{values:any[]}>}} db
 */
export async function ensureCustomersFtsBackfilled(db) {
  const flag = await db.query(`SELECT value FROM settings_kv WHERE key='fts_customers_built_v1'`, []);
  if (flag?.values?.length) return { skipped: true };
  await db.run(`INSERT INTO customers_fts(customers_fts) VALUES('rebuild')`, []);
  await db.run(
    `INSERT INTO settings_kv (key, value) VALUES ('fts_customers_built_v1', '1')
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    []
  );
  return { skipped: false };
}

/**
 * تمام statement های schema را روی یک اتصال دیتابیس اجرا می‌کند (idempotent —
 * همه‌ی CREATE ها با IF NOT EXISTS نوشته شده‌اند). این تابع مستقل از نوع
 * اتصال (Capacitor SQLite واقعی یا هر db-like دیگری با متد db.run) است.
 * @param {{run:(sql:string, params?:any[])=>Promise<any>}} db
 */
export async function applySchema(db) {
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.run(stmt);
  }
  await db.run(
    `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [String(SCHEMA_VERSION)]
  );
  // ✅ ۴.۱۸: بعد از ساخته‌شدن جدول‌ها/تریگرها، یک‌بار customers_fts را از روی
  // داده‌ی موجود (اگر باشد) پر می‌کند — برای دیتابیس‌های تازه بی‌اثر (جدول
  // خالی است)، برای دیتابیس‌هایی که از migrateFromIndexedDB داده گرفته‌اند
  // (که قبل از این نسخه اجرا شده)، همان یک‌بار لازم را انجام می‌دهد.
  await ensureCustomersFtsBackfilled(db);
}
