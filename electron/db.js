/* eslint-env node */

// electron/db.js
const path = require('path');
const Database = require('better-sqlite3');

// DB file next to app (simple & safe for now)
const dbPath = path.join(process.cwd(), 'billing.db');

const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL,
    date TEXT,
    customer_name TEXT,
    customer_address TEXT,
    customer_gstin TEXT,
    state_code TEXT,
    work_order_no TEXT,
    taxable_amount REAL,
    cgst_rate REAL,
    sgst_rate REAL,
    igst_rate REAL,
    cgst_amount REAL,
    sgst_amount REAL,
    igst_amount REAL,
    total_gst REAL,
    grand_total REAL,
    amount_in_words TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    sl_no INTEGER,
    description TEXT,
    hsn TEXT,
    qty REAL,
    rate REAL,
    amount REAL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );
`);

module.exports = db;
