// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import RajaInvoice from "./RajaInvoice";
import { exportInvoicePdf } from "./invoicePdf";

// --- helper: convert number to Indian rupees in words (simple) ---
function numberToWordsIndian(num) {
  if (!num || num === 0) return "Zero rupees only";

  const a = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100)
      return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " hundred" +
        (n % 100 ? " " + inWords(n % 100) : "")
      );
    return "";
  }

  const parts = [];
  const crore = Math.floor(num / 10000000);
  if (crore) {
    parts.push(inWords(crore) + " crore");
    num %= 10000000;
  }
  const lakh = Math.floor(num / 100000);
  if (lakh) {
    parts.push(inWords(lakh) + " lakh");
    num %= 100000;
  }
  const thousand = Math.floor(num / 1000);
  if (thousand) {
    parts.push(inWords(thousand) + " thousand");
    num %= 1000;
  }
  const hundred = Math.floor(num / 100);
  if (hundred) {
    parts.push(inWords(hundred) + " hundred");
    num %= 100;
  }
  if (num) parts.push(inWords(num));

  return (
    parts
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase()) + " rupees only"
  );
}

// helper: today in dd-mm-yyyy
const getTodayStr = () =>
  new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

// base meta template
const makeDefaultMeta = () => ({
  invoiceNo: "",
  date: getTodayStr(),

  customerName: "",
  customerAddress: "",
  customerGstin: "",
  stateCode: "",
  workOrderNo: "",

  cgstRate: "9",
  sgstRate: "9",
  igstRate: "28",

  note1: "Goods once sold will not be taken back.",
  note2:
    "All the disputes arising out of this invoice settled in Patna Jurisdiction.",
  bankDetails:
    "Bank of India, Jamal Road, Patna, A/C No. 44152010000578, IFSC - BKID0004415",

  companyName: "Raju Generator",
  companyGstin: "10AMXPP3961C1Z3",
  companyContact: "9308054050",
  companyDealsIn: "Generator Service, Repairing, Maintenance and Hire work.",
  companyAddress: "Exhibition Road, Raja Market, Patna - 800 001",
  signatoryName: "Pappu Bhardwaj",
});

// base blank item
const blankItem = {
  description: "",
  hsn: "",
  qty: "",
  rate: "",
  taxType: "CGST_SGST",
  unit: "",
};

function App() {
  // -------- ZOOM FOR PREVIEW --------
  const [zoom, setZoom] = useState(1);
  const zoomIn = () => setZoom((z) => Math.min(2.5, z + 0.1));
  const zoomOut = () => setZoom((z) => Math.max(0.5, z - 0.1));
  const zoomReset = () => setZoom(1);

  // -------- FORM STATE --------
  const [meta, setMeta] = useState(makeDefaultMeta);
  const [items, setItems] = useState([{ ...blankItem }]);

  const [invoiceList, setInvoiceList] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [saving, setSaving] = useState(false);

  // signature (company-level) — stored in localStorage so it persists
  const [signatureDataUrl, setSignatureDataUrl] = useState(() => {
    try {
      return localStorage.getItem("rg_signature") || "";
    } catch {
      return "";
    }
  });

  const handleSignatureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setSignatureDataUrl(dataUrl);
      try {
        localStorage.setItem("rg_signature", dataUrl);
      } catch {
        // ignore if localStorage not available
      }
    };
    reader.readAsDataURL(file);
  };

  // filters for saved list
  const [filterDate, setFilterDate] = useState(""); // yyyy-mm-dd
  const [filterInvoiceNo, setFilterInvoiceNo] = useState("");

  // layout widths (percent) for drag-resize
  const [layoutWidths, setLayoutWidths] = useState({
    list: 20,
    form: 35,
    preview: 45,
  });
  const dragInfoRef = useRef(null);

  // -------- HANDLERS ----------

  const handleMetaChange = (e) => {
    const { name, value } = e.target;
    setMeta((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // new item: all fields blank
  const addItem = () => {
    setItems((prev) => [...prev, { ...blankItem }]);
  };

  // remove item with confirmation
  const removeItem = (index) => {
    if (!window.confirm("Do you really want to remove this item row?")) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // start a completely new invoice
  const handleNewInvoice = () => {
    if (
      currentId ||
      meta.invoiceNo ||
      items.some(
        (it) => it.description || it.hsn || it.qty || it.rate || it.unit
      )
    ) {
      const ok = window.confirm(
        "Clear current invoice and start a new one?"
      );
      if (!ok) return;
    }
    setCurrentId(null);
    setMeta(makeDefaultMeta());
    setItems([{ ...blankItem }]);
  };

  // -------- CALCULATIONS (per-item CGST+SGST / IGST) --------
  const computed = useMemo(() => {
    const cgstRateNum = Number(meta.cgstRate || 0);
    const sgstRateNum = Number(meta.sgstRate || 0);
    const igstRateNum = Number(meta.igstRate || 0);

    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const normalizedItems = items.map((it) => {
      const qty = Number(it.qty || 0);
      const rate = Number(it.rate || 0);
      const amount = qty * rate;
      const taxType = it.taxType || "CGST_SGST";

      let cgstAmtItem = 0;
      let sgstAmtItem = 0;
      let igstAmtItem = 0;

      if (amount > 0) {
        if (taxType === "IGST") {
          igstAmtItem = (amount * igstRateNum) / 100;
        } else {
          cgstAmtItem = (amount * cgstRateNum) / 100;
          sgstAmtItem = (amount * sgstRateNum) / 100;
        }
      }

      taxableAmount += amount;
      totalCgst += cgstAmtItem;
      totalSgst += sgstAmtItem;
      totalIgst += igstAmtItem;

      return {
        ...it,
        qty,
        rate,
        amount,
        taxType,
        cgstAmtItem,
        sgstAmtItem,
        igstAmtItem,
      };
    });

    const totalGst = totalCgst + totalSgst + totalIgst;
    const grandTotal = taxableAmount + totalGst;
    const amountInWords = numberToWordsIndian(Math.round(grandTotal));

    return {
      items: normalizedItems,
      taxableAmount,
      cgstAmount: totalCgst,
      sgstAmount: totalSgst,
      igstAmount: totalIgst,
      totalGst,
      grandTotal,
      amountInWords,
      cgstRateNum,
      sgstRateNum,
      igstRateNum,
    };
  }, [items, meta.cgstRate, meta.sgstRate, meta.igstRate]);

  // -------- Build invoice object for preview + saving + PDF --------
  const invoice = {
    id: currentId || undefined,
    invoiceNo: meta.invoiceNo,
    date: meta.date,
    customerName: meta.customerName,
    customerAddress: meta.customerAddress,
    customerGstin: meta.customerGstin,
    stateCode: meta.stateCode,
    workOrderNo: meta.workOrderNo,
    items: computed.items,
    taxableAmount: computed.taxableAmount,
    cgstRate: computed.cgstRateNum,
    sgstRate: computed.sgstRateNum,
    igstRate: computed.igstRateNum,
    cgstAmount: computed.cgstAmount,
    sgstAmount: computed.sgstAmount,
    igstAmount: computed.igstAmount,
    totalGst: computed.totalGst,
    grandTotal: computed.grandTotal,
    amountInWords: computed.amountInWords,
    bankDetails: meta.bankDetails,
    notes: [meta.note1, meta.note2],
    company: {
      name: meta.companyName,
      gstin: meta.companyGstin,
      contact: meta.companyContact,
      dealsIn: meta.companyDealsIn,
      address: meta.companyAddress,
      signatoryName: meta.signatoryName,
      signatureDataUrl, // NEW: signature image for invoice + PDF
    },
  };

  // Export PDF (multi-page, pad style)
  const handleExportPdf = () => {
    try {
      exportInvoicePdf(invoice);
    } catch (err) {
      console.error("PDF export failed", err);
      alert("PDF export failed: " + err.message);
    }
  };

  // -------- DB OPERATIONS via IPC --------
  const refreshList = async () => {
    if (!window.billingAPI?.listInvoices) return;
    const rows = await window.billingAPI.listInvoices();
    setInvoiceList(rows);
  };

  useEffect(() => {
    refreshList();
  }, []);

  // create or update
  const handleSave = async () => {
    if (!window.billingAPI?.createInvoice) return;
    setSaving(true);
    try {
      if (currentId && window.billingAPI.updateInvoice) {
        await window.billingAPI.updateInvoice({
          id: currentId,
          invoice,
        });
        await refreshList();
        alert("Invoice updated successfully.");
      } else {
        const res = await window.billingAPI.createInvoice(invoice);
        setCurrentId(res.id);
        await refreshList();
        alert("Invoice saved successfully.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving invoice: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadInvoice = async (id) => {
    if (!window.billingAPI?.getInvoice) return;
    const data = await window.billingAPI.getInvoice(id);
    if (!data) return;

    const inv = data.invoice;
    const its = data.items;

    setCurrentId(inv.id);
    setMeta((prev) => ({
      ...prev,
      invoiceNo: inv.invoice_no,
      date: inv.date,
      customerName: inv.customer_name,
      customerAddress: inv.customer_address,
      customerGstin: inv.customer_gstin,
      stateCode: inv.state_code,
      workOrderNo: inv.work_order_no,
      cgstRate: String(inv.cgst_rate ?? prev.cgstRate),
      sgstRate: String(inv.sgst_rate ?? prev.sgstRate),
      igstRate: String(inv.igst_rate ?? prev.igstRate),
    }));

    setItems(
      its.map((it) => ({
        description: it.description,
        hsn: it.hsn,
        qty: String(it.qty),
        rate: String(it.rate),
        taxType: it.tax_type || "CGST_SGST",
        unit: it.unit || "",
      }))
    );
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.billingAPI?.deleteInvoice) {
      alert("Delete is not configured in this build.");
      return;
    }
    const ok = window.confirm(
      "Do you really want to delete this invoice permanently?"
    );
    if (!ok) return;

    try {
      await window.billingAPI.deleteInvoice(id);
      if (currentId === id) {
        handleNewInvoice();
      }
      await refreshList();
      alert("Invoice deleted successfully.");
    } catch (err) {
      console.error(err);
      alert("Error deleting invoice: " + err.message);
    }
  };

  // -------- FILTERING (date + invoice no) --------
  const toDdMmYyyy = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  };

  const filteredInvoices = invoiceList.filter((inv) => {
    if (filterInvoiceNo.trim()) {
      if (
        !inv.invoice_no
          ?.toLowerCase()
          .includes(filterInvoiceNo.trim().toLowerCase())
      ) {
        return false;
      }
    }

    if (filterDate) {
      const needle = toDdMmYyyy(filterDate);
      if (inv.date !== needle) return false;
    }

    return true;
  });

  // -------- DRAG-RESIZE HANDLES --------
  const startDrag = (e, handle) => {
    const container = document.querySelector(".app-layout");
    const totalWidth = container?.clientWidth || window.innerWidth;

    dragInfoRef.current = {
      handle,
      startX: e.clientX,
      totalWidth,
      startWidths: { ...layoutWidths },
    };

    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDrag);
  };

  const onDrag = (e) => {
    const info = dragInfoRef.current;
    if (!info) return;

    const deltaX = e.clientX - info.startX;
    const deltaPercent = (deltaX / info.totalWidth) * 100;

    let { list, form, preview } = info.startWidths;

    if (info.handle === "list") {
      let newList = Math.min(35, Math.max(10, list + deltaPercent));
      let diff = newList - list;
      let newForm = Math.max(20, form - diff);
      setLayoutWidths({
        list: newList,
        form: newForm,
        preview,
      });
    } else if (info.handle === "form") {
      let newForm = Math.min(55, Math.max(20, form + deltaPercent));
      let diff = newForm - form;
      let newPreview = Math.max(25, preview - diff);
      setLayoutWidths({
        list,
        form: newForm,
        preview: newPreview,
      });
    }
  };

  const stopDrag = () => {
    dragInfoRef.current = null;
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", stopDrag);
  };

  // -------- RENDER --------
  return (
    <div className="app-layout">
      {/* LEFT SIDEBAR: OLD INVOICES */}
      <div
        className="list-pane no-print"
        style={{ width: `${layoutWidths.list}%` }}
      >
        <div className="list-header">
          <h3>Saved Invoices</h3>
          <button
            className="btn-secondary"
            style={{ marginRight: "4px" }}
            onClick={refreshList}
          >
            Reload
          </button>
          <button className="btn-primary" onClick={handleNewInvoice}>
            + New Invoice
          </button>
        </div>

        <div className="filter-block">
          <div className="form-row">
            <span>Filter by Date:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          <div className="form-row">
            <span>Invoice No:</span>
            <input
              value={filterInvoiceNo}
              onChange={(e) => setFilterInvoiceNo(e.target.value)}
              placeholder="Search..."
            />
          </div>
        </div>

        <ul className="invoice-list">
          {filteredInvoices.map((invRow) => (
            <li
              key={invRow.id}
              className={
                invRow.id === currentId ? "invoice-item active" : "invoice-item"
              }
            >
              <div
                className="invoice-item-main"
                onClick={() => handleLoadInvoice(invRow.id)}
              >
                <div className="invoice-item-line">
                  <strong>{invRow.invoice_no}</strong>
                </div>
                <div className="invoice-item-line small">
                  {invRow.date} – {invRow.customer_name}
                </div>
                <div className="invoice-item-line small">
                  Total: {invRow.grand_total?.toLocaleString("en-IN")}
                </div>
              </div>
              <button
                className="btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteInvoice(invRow.id);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* drag handle between list and form */}
      <div
        className="drag-handle no-print"
        onMouseDown={(e) => startDrag(e, "list")}
      />

      {/* MIDDLE: ENTRY FORM */}
      <div
        className="form-pane no-print"
        style={{ width: `${layoutWidths.form}%` }}
      >
        <h2>Bill Entry (Manual)</h2>

        <h3 className="form-section-title">Invoice Details</h3>
        <div className="form-row">
          <span>Invoice No:</span>
          <input
            name="invoiceNo"
            value={meta.invoiceNo}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Date:</span>
          <input
            name="date"
            value={meta.date}
            onChange={handleMetaChange}
            placeholder="dd-mm-yyyy"
          />
        </div>

        <h3 className="form-section-title">Customer</h3>
        <div className="form-row">
          <span>Name:</span>
          <input
            name="customerName"
            value={meta.customerName}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Address:</span>
          <textarea
            name="customerAddress"
            value={meta.customerAddress}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>GSTIN:</span>
          <input
            name="customerGstin"
            value={meta.customerGstin}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>State Code:</span>
          <input
            name="stateCode"
            value={meta.stateCode}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Work Order No.:</span>
          <input
            name="workOrderNo"
            value={meta.workOrderNo}
            onChange={handleMetaChange}
          />
        </div>

        <h3 className="form-section-title">Items</h3>
        {items.map((it, idx) => (
          <div key={idx} className="item-block">
            <div className="item-block-header">
              <span>Item #{idx + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removeItem(idx)}
                >
                  Remove
                </button>
              )}
            </div>

            <div className="form-row">
              <span>Description:</span>
              <textarea
                value={it.description}
                onChange={(e) =>
                  handleItemChange(idx, "description", e.target.value)
                }
              />
            </div>
            <div className="form-row">
              <span>HSN/SAC:</span>
              <input
                value={it.hsn}
                onChange={(e) =>
                  handleItemChange(idx, "hsn", e.target.value)
                }
              />
            </div>
            <div className="form-row">
              <span>Qty:</span>
              <input
                type="number"
                value={it.qty}
                onChange={(e) =>
                  handleItemChange(idx, "qty", e.target.value)
                }
              />
            </div>
            <div className="form-row">
              <span>Unit:</span>
              <input
                value={it.unit || ""}
                onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
              />
            </div>
            <div className="form-row">
              <span>Rate:</span>
              <input
                type="number"
                value={it.rate}
                onChange={(e) =>
                  handleItemChange(idx, "rate", e.target.value)
                }
              />
            </div>
            <div className="form-row">
              <span>Tax Type:</span>
              <select
                value={it.taxType || "CGST_SGST"}
                onChange={(e) =>
                  handleItemChange(idx, "taxType", e.target.value)
                }
              >
                <option value="CGST_SGST">CGST + SGST</option>
                <option value="IGST">IGST only</option>
              </select>
            </div>

            <div className="form-row">
              <span>Amount (Taxable):</span>
              <input
                disabled
                value={(
                  (Number(it.qty || 0) * Number(it.rate || 0)) || 0
                ).toLocaleString("en-IN")}
              />
            </div>
          </div>
        ))}
        <button type="button" onClick={addItem} className="btn-secondary">
          + Add Item
        </button>

        <h3 className="form-section-title">Tax</h3>
        <div className="form-row">
          <span>CGST %:</span>
          <input
            name="cgstRate"
            type="number"
            value={meta.cgstRate}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>SGST %:</span>
          <input
            name="sgstRate"
            type="number"
            value={meta.sgstRate}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>IGST %:</span>
          <input
            name="igstRate"
            type="number"
            value={meta.igstRate}
            onChange={handleMetaChange}
          />
        </div>

        <h3 className="form-section-title">Totals</h3>
        <div className="form-row">
          <span>Taxable:</span>
          <input
            disabled
            value={computed.taxableAmount.toLocaleString("en-IN")}
          />
        </div>
        <div className="form-row">
          <span>CGST:</span>
          <input
            disabled
            value={computed.cgstAmount.toLocaleString("en-IN")}
          />
        </div>
        <div className="form-row">
          <span>SGST:</span>
          <input
            disabled
            value={computed.sgstAmount.toLocaleString("en-IN")}
          />
        </div>
        <div className="form-row">
          <span>IGST:</span>
          <input
            disabled
            value={computed.igstAmount.toLocaleString("en-IN")}
          />
        </div>
        <div className="form-row">
          <span>Grand Total:</span>
          <input
            disabled
            value={computed.grandTotal.toLocaleString("en-IN")}
          />
        </div>
        <div className="form-row">
          <span>In words:</span>
          <textarea disabled value={computed.amountInWords} />
        </div>

        <h3 className="form-section-title">Notes & Bank</h3>
        <div className="form-row">
          <span>Note 1:</span>
          <textarea
            name="note1"
            value={meta.note1}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Note 2:</span>
          <textarea
            name="note2"
            value={meta.note2}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Bank Details:</span>
          <textarea
            name="bankDetails"
            value={meta.bankDetails}
            onChange={handleMetaChange}
          />
        </div>

        <h3 className="form-section-title">Company</h3>
        <div className="form-row">
          <span>Firm Name:</span>
          <input
            name="companyName"
            value={meta.companyName}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Firm GSTIN:</span>
          <input
            name="companyGstin"
            value={meta.companyGstin}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Contact No.:</span>
          <input
            name="companyContact"
            value={meta.companyContact}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Deals In:</span>
          <textarea
            name="companyDealsIn"
            value={meta.companyDealsIn}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Address:</span>
          <textarea
            name="companyAddress"
            value={meta.companyAddress}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Signatory (name, optional):</span>
          <input
            name="signatoryName"
            value={meta.signatoryName}
            onChange={handleMetaChange}
          />
        </div>
        <div className="form-row">
          <span>Signature (JPG):</span>
          <input
            type="file"
            accept="image/jpeg,image/jpg"
            onChange={handleSignatureChange}
          />
        </div>

        <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving
              ? "Saving..."
              : currentId
              ? "Update Invoice"
              : "Save Invoice"}
          </button>
          <button onClick={handleExportPdf} className="btn-secondary">
            Export PDF (A4 Multi-page)
          </button>
        </div>
      </div>

      {/* drag handle between form and preview */}
      <div
        className="drag-handle no-print"
        onMouseDown={(e) => startDrag(e, "form")}
      />

      {/* RIGHT: INVOICE PREVIEW with ZOOM */}
      <div
        className="preview-pane"
        style={{ width: `${layoutWidths.preview}%` }}
      >
        <div
          className="preview-toolbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontWeight: 600 }}>Invoice Preview</span>
          <div
            className="zoom-controls"
            style={{ display: "flex", gap: 4, alignItems: "center" }}
          >
            <button onClick={zoomOut}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn}>+</button>
            <button onClick={zoomReset}>Reset</button>
          </div>
        </div>

        <div
          className="preview-zoom-wrapper"
          style={{
            overflow: "auto",
            border: "1px solid #ccc",
            padding: 4,
            background: "#dcdcdc",
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: `${100 / zoom}%`,
            }}
          >
            <RajaInvoice invoice={invoice} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
