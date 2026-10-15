// تمام ماژول‌های دیتابیس در یک باندل واحد تا اتصال SQLite بین آن‌ها مشترک بماند
import html2canvas from 'html2canvas';
import * as jspdf from 'jspdf';
window.html2canvas = html2canvas;
window.jspdf = jspdf;
export { migrate } from './src/db/migrateFromIndexedDB.js';
export * as InvoiceRepo from './src/db/InvoiceRepo.js';
export * as CustomerRepo from './src/db/CustomerRepo.js';
export { InvoiceCache } from './src/cache/InvoiceCache.js';
