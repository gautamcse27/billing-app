// electron/main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const db = require("./db");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    win.loadFile(indexPath);
  }

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.log("❌ did-fail-load:", code, desc, url);
  });
}

// ---------- IPC HANDLERS ----------

// Simple test
ipcMain.handle("ping", () => {
  return "pong from main process";
});

// CREATE invoice (+ items)
ipcMain.handle("invoice:create", (_event, invoice) => {
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      invoice_no,
      date,
      customer_name,
      customer_address,
      customer_gstin,
      state_code,
      work_order_no,
      taxable_amount,
      cgst_rate,
      sgst_rate,
      igst_rate,
      cgst_amount,
      sgst_amount,
      igst_amount,
      total_gst,
      grand_total,
      amount_in_words
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (
      invoice_id,
      sl_no,
      description,
      hsn,
      qty,
      rate,
      amount,
      unit,
      tax_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        it.amount,
        it.unit || "Nos.",
        it.taxType || "CGST_SGST"
      );
    });

    return invoiceId;
  });

  const invoiceId = tx(invoice);
  return { success: true, id: invoiceId };
});

// LIST invoices (for sidebar)
ipcMain.handle("invoice:list", () => {
  const rows = db
    .prepare(
      `
      SELECT id, invoice_no, date, customer_name, grand_total
      FROM invoices
      ORDER BY id DESC
    `
    )
    .all();
  return rows;
});

// GET single invoice + items  ⚠️ THIS SHOULD EXIST ONLY ONCE
ipcMain.handle("invoice:get", (_event, id) => {
  const inv = db
    .prepare(
      `
      SELECT *
      FROM invoices
      WHERE id = ?
    `
    )
    .get(id);

  if (!inv) return null;

  const items = db
    .prepare(
      `
      SELECT
        sl_no,
        description,
        hsn,
        qty,
        rate,
        amount,
        unit,
        tax_type
      FROM invoice_items
      WHERE invoice_id = ?
      ORDER BY sl_no
    `
    )
    .all(id);

  return { invoice: inv, items };
});

// UPDATE invoice (overwrite header + items)
ipcMain.handle("invoice:update", (_event, payload) => {
  const { id, invoice } = payload;
  if (!id) throw new Error("Missing invoice id for update.");

  const updateInvoice = db.prepare(`
    UPDATE invoices
    SET
      invoice_no = ?,
      date = ?,
      customer_name = ?,
      customer_address = ?,
      customer_gstin = ?,
      state_code = ?,
      work_order_no = ?,
      taxable_amount = ?,
      cgst_rate = ?,
      sgst_rate = ?,
      igst_rate = ?,
      cgst_amount = ?,
      sgst_amount = ?,
      igst_amount = ?,
      total_gst = ?,
      grand_total = ?,
      amount_in_words = ?
    WHERE id = ?
  `);

  const deleteItems = db.prepare(
    `DELETE FROM invoice_items WHERE invoice_id = ?`
  );

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (
      invoice_id,
      sl_no,
      description,
      hsn,
      qty,
      rate,
      amount,
      unit,
      tax_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((invId, inv) => {
    // update main invoice row
    updateInvoice.run(
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
      inv.amountInWords,
      invId
    );

    // replace items
    deleteItems.run(invId);

    inv.items.forEach((it, idx) => {
      insertItem.run(
        invId,
        idx + 1,
        it.description,
        it.hsn,
        it.qty,
        it.rate,
        it.amount,
        it.unit || "Nos.",
        it.taxType || "CGST_SGST"
      );
    });
  });

  tx(id, invoice);

  return { success: true };
});

// DELETE invoice
ipcMain.handle("invoice:delete", (_event, id) => {
  const deleteItems = db.prepare(
    `DELETE FROM invoice_items WHERE invoice_id = ?`
  );
  const deleteInvoice = db.prepare(`DELETE FROM invoices WHERE id = ?`);

  const tx = db.transaction((invoiceId) => {
    deleteItems.run(invoiceId);
    deleteInvoice.run(invoiceId);
  });

  tx(id);
  return { success: true };
});

// ---------- APP LIFECYCLE ----------
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
