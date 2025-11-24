// electron/db.js
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { app } = require("electron");

// Decide where to store the DB:
// - in dev & in the packaged app, we use the user's app-data folder
//   e.g. on mac: ~/Library/Application Support/Raju Generator Billing/
const appName = "Raju Generator Billing";

function getDbPath() {
  // userData path is managed by Electron and always exists
  const userDataPath = app.getPath("userData"); // e.g. ~/Library/Application Support/<appname>
  const dbDir = path.join(userDataPath, "data");

  // ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return path.join(dbDir, "billing.db");
}

// IMPORTANT: app.getPath is safe here because main.js requires db.js
// after Electron is initialized (app.whenReady used in main).
const dbPath = getDbPath();

// create / open sqlite database file
const db = new Database(dbPath);

// ---- your existing schema setup below ----

// Example (keep whatever you already had)
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT,
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
    amount_in_words TEXT
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    sl_no INTEGER,
    description TEXT,
    hsn TEXT,
    qty REAL,
    rate REAL,
    amount REAL,
    unit TEXT,
    tax_type TEXT,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );
`);

module.exports = db;
