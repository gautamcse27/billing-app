// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  if (process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    win.loadFile(indexPath);
  }

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.log('❌ did-fail-load:', code, desc, url);
  });
}

// ---------- IPC HANDLERS ----------

// Test
ipcMain.handle('ping', () => {
  return 'pong from main process';
});

// Save invoice (+ items)
ipcMain.handle('invoice:create', (_event, invoice) => {
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      invoice_no, date, customer_name, customer_address, customer_gstin,
      state_code, work_order_no, taxable_amount,
      cgst_rate, sgst_rate, igst_rate,
      cgst_amount, sgst_amount, igst_amount,
      total_gst, grand_total, amount_in_words
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (
      invoice_id, sl_no, description, hsn, qty, rate, amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((inv) => {
    const result = insertInvoice.run(
      inv.invoiceNo,
      inv.date,
      inv.customerName,
      inv.customerAddress,
      inv.customerGstin,
      inv.stateCode,
      inv.workOrderNo,
      inv.taxableAmount,
      inv.cgstRate,
      inv.sgstRate,
      inv.igstRate,
      inv.cgstAmount,
      inv.sgstAmount,
      inv.igstAmount,
      inv.totalGst,
      inv.grandTotal,
      inv.amountInWords
    );

    const invoiceId = result.lastInsertRowid;

    inv.items.forEach((it, idx) => {
      insertItem.run(
        invoiceId,
        idx + 1,
        it.description,
        it.hsn,
        it.qty,
        it.rate,
        it.amount
      );
    });

    return invoiceId;
  });

  const invoiceId = tx(invoice);
  return { success: true, id: invoiceId };
});

// List invoices (for sidebar)
ipcMain.handle('invoice:list', () => {
  const rows = db.prepare(`
    SELECT id, invoice_no, date, customer_name, grand_total
    FROM invoices
    ORDER BY id DESC
  `).all();
  return rows;
});

// Get single invoice + items
ipcMain.handle('invoice:get', (_event, id) => {
  const inv = db.prepare(`
    SELECT *
    FROM invoices
    WHERE id = ?
  `).get(id);

  if (!inv) return null;

  const items = db.prepare(`
    SELECT sl_no, description, hsn, qty, rate, amount
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY sl_no
  `).all(id);

  return { invoice: inv, items };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
