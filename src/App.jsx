import { useEffect, useMemo, useState } from "react";
import RajaInvoice from "./RajaInvoice";

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

function App() {
  // today's date in dd-mm-yyyy
  const todayStr = new Date()
    .toLocaleDateString("en-GB") // dd/mm/yyyy
    .replace(/\//g, "-");

  // -------- FORM STATE --------
  const [meta, setMeta] = useState({
    invoiceNo: "",          // you type manually
    date: todayStr,         // auto today

    // CUSTOMER + TRANSPORT DETAILS – you type manually
    customerName: "",
    customerAddress: "",
    customerGstin: "",
    stateCode: "",
    workOrderNo: "",

    // TAX – pre-filled (can edit)
    cgstRate: "9",
    sgstRate: "9",
    igstRate: "18",

    // BOTTOM – pre-filled Note & Bank details
    note1: "Goods once sold will not be taken back.",
    note2:
      "All the disputes arising out of this invoice settled in Patna Jurisdiction.",
    bankDetails:
      "Bank of India, Jamal Road, Patna, A/C No. 44152010000578, IFSC - BKID0004415",

    // HEADER / BOTTOM company details – pre-filled for Raju Generator
    companyName: "Raju Generator",
    companyGstin: "10AMXPP3961C1Z3",
    companyContact: "9308054050",
    companyDealsIn: "Generator Service, Repairing, Maintenance and Hire work.",
    companyAddress: "Exhibition Road, Raja Market, Patna - 800 001",
    signatoryName: "Pappu Bhardwaj",
  });

  // ITEMS – one row to start
  const [items, setItems] = useState([
    {
      description: "",
      hsn: "997319",
      qty: "1",
      rate: "40000",
    },
  ]);

  const [invoiceList, setInvoiceList] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { description: "", hsn: "997319", qty: "1", rate: "40000" },
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // -------- CALCULATIONS --------
  const computed = useMemo(() => {
    const normalizedItems = items.map((it) => {
      const qty = Number(it.qty || 0);
      const rate = Number(it.rate || 0);
      return {
        ...it,
        qty,
        rate,
        amount: qty * rate,
      };
    });

    const taxableAmount = normalizedItems.reduce(
      (sum, it) => sum + it.amount,
      0
    );

    const cgstRateNum = Number(meta.cgstRate || 0);
    const sgstRateNum = Number(meta.sgstRate || 0);
    const igstRateNum = Number(meta.igstRate || 0);

    const cgstAmount = (taxableAmount * cgstRateNum) / 100;
    const sgstAmount = (taxableAmount * sgstRateNum) / 100;
    const igstAmount = (taxableAmount * igstRateNum) / 100;
    const totalGst = cgstAmount + sgstAmount + igstAmount;
    const grandTotal = taxableAmount + totalGst;

    const amountInWords = numberToWordsIndian(Math.round(grandTotal));

    return {
      items: normalizedItems,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalGst,
      grandTotal,
      amountInWords,
      cgstRateNum,
      sgstRateNum,
      igstRateNum,
    };
  }, [items, meta.cgstRate, meta.sgstRate, meta.igstRate]);

  // Build invoice object for RajaInvoice + saving
  const invoice = {
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
    },
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

  const handleSave = async () => {
    if (!window.billingAPI?.createInvoice) return;
    setSaving(true);
    try {
      const res = await window.billingAPI.createInvoice(invoice);
      setCurrentId(res.id);
      await refreshList();
      alert("Invoice saved with ID: " + res.id);
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
      }))
    );
  };

  // -------- SIMPLE PRINT: use @media print from index.css --------
  const handlePrint = () => {
    window.print();
  };

  // -------- RENDER --------
  return (
    <div className="app-layout">
      {/* LEFT SIDEBAR: OLD INVOICES */}
      <div className="list-pane no-print">
        <h3>Saved Invoices</h3>
        <button
          style={{ fontSize: "12px", marginBottom: "8px" }}
          onClick={refreshList}
        >
          Reload List
        </button>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {invoiceList.map((invRow) => (
            <li
              key={invRow.id}
              onClick={() => handleLoadInvoice(invRow.id)}
              style={{
                padding: "4px",
                marginBottom: "4px",
                cursor: "pointer",
                background:
                  invRow.id === currentId ? "rgba(0,0,0,0.1)" : "transparent",
                borderRadius: "4px",
              }}
            >
              <div>
                <strong>{invRow.invoice_no}</strong>
              </div>
              <div>{invRow.customer_name}</div>
              <div>₹ {invRow.grand_total?.toLocaleString("en-IN")}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* MIDDLE: ENTRY FORM */}
      <div className="form-pane no-print">
        <h2>Bill Entry (Manual)</h2>

        <h3>Invoice Details</h3>
        <label>
          Invoice No:
          <input
            name="invoiceNo"
            value={meta.invoiceNo}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          Date:
          <input
            name="date"
            value={meta.date}
            onChange={handleMetaChange}
          />
        </label>

        <h3>Customer</h3>
        <label>
          Name:
          <input
            name="customerName"
            value={meta.customerName}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          Address:
          <textarea
            name="customerAddress"
            value={meta.customerAddress}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          GSTIN:
          <input
            name="customerGstin"
            value={meta.customerGstin}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          State Code:
          <input
            name="stateCode"
            value={meta.stateCode}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          Work Order No.:
          <input
            name="workOrderNo"
            value={meta.workOrderNo}
            onChange={handleMetaChange}
          />
        </label>

        <h3>Items</h3>
        {items.map((it, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid #ccc",
              padding: "6px",
              marginBottom: "6px",
              borderRadius: "4px",
            }}
          >
            <div>Sl. No.: {idx + 1}</div>
            <label>
              Description:
              <textarea
                value={it.description}
                onChange={(e) =>
                  handleItemChange(idx, "description", e.target.value)
                }
              />
            </label>
            <label>
              HSN/SAC:
              <input
                value={it.hsn}
                onChange={(e) =>
                  handleItemChange(idx, "hsn", e.target.value)
                }
              />
            </label>
            <label>
              Qty:
              <input
                type="number"
                value={it.qty}
                onChange={(e) =>
                  handleItemChange(idx, "qty", e.target.value)
                }
              />
            </label>
            <label>
              Rate:
              <input
                type="number"
                value={it.rate}
                onChange={(e) =>
                  handleItemChange(idx, "rate", e.target.value)
                }
              />
            </label>
            <div>
              Amount:{" "}
              {(
                (Number(it.qty || 0) * Number(it.rate || 0)) ||
                0
              ).toLocaleString("en-IN")}
            </div>
            {items.length > 1 && (
              <button
                type="button"
                style={{ marginTop: "4px", fontSize: "11px" }}
                onClick={() => removeItem(idx)}
              >
                Remove Item
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addItem} style={{ fontSize: "12px" }}>
          + Add Item
        </button>

        <h3>Tax</h3>
        <label>
          CGST %:
          <input
            name="cgstRate"
            type="number"
            value={meta.cgstRate}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          SGST %:
          <input
            name="sgstRate"
            type="number"
            value={meta.sgstRate}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          IGST %:
          <input
            name="igstRate"
            type="number"
            value={meta.igstRate}
            onChange={handleMetaChange}
          />
        </label>

        <h3>Totals</h3>
        <div>Taxable: ₹ {computed.taxableAmount.toLocaleString("en-IN")}</div>
        <div>CGST: ₹ {computed.cgstAmount.toLocaleString("en-IN")}</div>
        <div>SGST: ₹ {computed.sgstAmount.toLocaleString("en-IN")}</div>
        <div>IGST: ₹ {computed.igstAmount.toLocaleString("en-IN")}</div>
        <div>
          <strong>
            Grand Total: ₹ {computed.grandTotal.toLocaleString("en-IN")}
          </strong>
        </div>
        <div>In words: {computed.amountInWords}</div>

        <h3>Notes & Bank</h3>
        <textarea
          name="note1"
          value={meta.note1}
          onChange={handleMetaChange}
        />
        <textarea
          name="note2"
          value={meta.note2}
          onChange={handleMetaChange}
        />
        <textarea
          name="bankDetails"
          value={meta.bankDetails}
          onChange={handleMetaChange}
        />

        <h3>Company</h3>
        <label>
          Firm Name:
          <input
            name="companyName"
            value={meta.companyName}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          Firm GSTIN:
          <input
            name="companyGstin"
            value={meta.companyGstin}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          Contact No.:
          <input
            name="companyContact"
            value={meta.companyContact}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          Deals In:
          <textarea
            name="companyDealsIn"
            value={meta.companyDealsIn}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          Address:
          <textarea
            name="companyAddress"
            value={meta.companyAddress}
            onChange={handleMetaChange}
          />
        </label>
        <label>
          Signatory:
          <input
            name="signatoryName"
            value={meta.signatoryName}
            onChange={handleMetaChange}
          />
        </label>

        <div style={{ marginTop: "10px" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ marginRight: "8px" }}
          >
            {saving ? "Saving..." : "Save Invoice"}
          </button>
          <button onClick={handlePrint}>Print / Save PDF</button>
        </div>
      </div>

      {/* RIGHT: INVOICE PREVIEW (this is what prints) */}
      <div className="preview-pane">
        <RajaInvoice invoice={invoice} />
      </div>
    </div>
  );
}

export default App;
