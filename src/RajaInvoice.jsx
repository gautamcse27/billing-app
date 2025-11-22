// src/RajaInvoice.jsx
import React from "react";

const RajaInvoice = ({ invoice }) => {
  const {
    invoiceNo,
    date,
    customerName,
    customerAddress,
    customerGstin,
    stateCode,
    workOrderNo,
    items,
    taxableAmount,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGst,
    grandTotal,
    amountInWords,
    bankDetails,
    notes,
    company,
  } = invoice;

  return (
    <div className="invoice-page">
      <div className="invoice-wrapper">
        {/* ===== HEADER ===== */}
        <div className="inv-header-top">
          <div>GST IN : {company.gstin}</div>
          <div className="inv-title">TAX INVOICE</div>
          <div>Contact No.: {company.contact}</div>
        </div>

        <div className="inv-firm-name">{company.name}</div>
        <div className="inv-firm-tagline">
          Deals in : {company.dealsIn}
        </div>
        <div className="inv-firm-address">{company.address}</div>

        <div className="inv-meta-row">
          <div className="inv-meta-box">
            Invoice No : <span className="inv-meta-value">{invoiceNo}</span>
          </div>
          <div className="inv-meta-box inv-meta-right">
            Date : <span className="inv-meta-value">{date}</span>
          </div>
        </div>

        {/* ===== CUSTOMER / TRANSPORTER ===== */}
        <div className="inv-customer-section">
          <div className="inv-cust-left">
            <div className="inv-box-title">Customer Details:</div>
            <div className="inv-field">
              Name: <span className="inv-field-value">{customerName}</span>
            </div>
            <div className="inv-field">
              Address:{" "}
              <span className="inv-field-value">{customerAddress}</span>
            </div>
            <div className="inv-field">
              GSTIN No.:{" "}
              <span className="inv-field-value">{customerGstin}</span>
            </div>
            <div className="inv-field">
              State Code:{" "}
              <span className="inv-field-value">{stateCode}</span>
            </div>
          </div>

          <div className="inv-cust-right">
            <div className="inv-box-title">Transporter Details:</div>
            <div className="inv-field">
              Work Order No.:{" "}
              <span className="inv-field-value">{workOrderNo}</span>
            </div>
          </div>
        </div>

        {/* ===== ITEMS TABLE ===== */}
        <table className="inv-items-table">
          <thead>
            <tr>
              <th style={{ width: "5%" }}>Sl. No.</th>
              <th style={{ width: "38%" }}>DESCRIPTION OF SUPPLY</th>
              <th style={{ width: "9%" }}>HSN / SAC</th>
              <th style={{ width: "7%" }}>QTY.</th>
              <th style={{ width: "7%" }}>UNIT</th>
              <th style={{ width: "12%" }}>RATE / ITEM (₹)</th>
              <th style={{ width: "7%" }}>TAX %</th>
              <th style={{ width: "15%" }}>TAXABLE VALUE (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const taxType = it.taxType || "CGST_SGST";
              const effectiveRate =
                taxType === "IGST"
                  ? igstRate
                  : (cgstRate || 0) + (sgstRate || 0); // total % for CGST+SGST

              return (
                <tr key={idx}>
                  <td className="align-center">{idx + 1}</td>
                  <td>{it.description}</td>
                  <td className="align-center">{it.hsn}</td>
                  <td className="align-center">{it.qty}</td>
                  <td className="align-center">{it.unit || ""}</td>
                  <td className="align-right">
                    {Number(it.rate || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="align-center">
                    {effectiveRate ? `${effectiveRate}%` : ""}
                  </td>
                  <td className="align-right">
                    {Number(it.amount || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              );
            })}

            {/* Total taxable value row */}
            <tr className="inv-items-total-row">
              <td colSpan={7} className="align-right">
                <strong>Total Taxable Value</strong>
              </td>
              <td className="align-right">
                <strong>{taxableAmount.toLocaleString("en-IN")}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ===== TAX SUMMARY (full width) ===== */}
        <div className="inv-tax-box">
          <div className="inv-tax-line">
            <span>Taxable Amount</span>
            <span className="amount">
              {taxableAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="inv-tax-line">
            <span>ADD CGST @ {cgstRate}%</span>
            <span className="amount">
              {cgstAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="inv-tax-line">
            <span>ADD SGST @ {sgstRate}%</span>
            <span className="amount">
              {sgstAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="inv-tax-line">
            <span>ADD IGST @ {igstRate}%</span>
            <span className="amount">
              {igstAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="inv-tax-line inv-tax-total">
            <span>Total GST</span>
            <span className="amount">
              {totalGst.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="inv-tax-line inv-tax-grand">
            <span>GRAND TOTAL</span>
            <span className="amount">
              {grandTotal.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* ===== AMOUNT IN WORDS ===== */}
        <div className="inv-amount-words">
          Rupees: <span>{amountInWords}</span>
        </div>

        {/* ===== NOTE + BANK + SIGNATURE ===== */}
        <div className="inv-bottom-row">
          <div className="inv-bottom-left">
            <div className="inv-box-title">Note :</div>
            <ol className="inv-notes">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ol>

            <div className="inv-box-title" style={{ marginTop: "4px" }}>
              Bank Details :
            </div>
            <div>{bankDetails}</div>
          </div>

          <div className="inv-bottom-right">
            <div className="inv-for-label">For {company.name}</div>
            <div className="inv-sign-space" />
            <div className="inv-sign-name">{company.signatoryName}</div>
            <div className="inv-sign-caption">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RajaInvoice;
