// src/invoicePdf.js
import jsPDF from "jspdf";
import "jspdf-autotable";

/**
 * Generate multi-page A4 PDF for invoice with pad-like layout.
 * It uses invoice data coming from App.jsx.
 */
export function exportInvoicePdf(invoice) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 10;
  const marginTop = 8;
  const marginRight = 10;

  // We’ll keep some space reserved for bottom block (tax + notes + signature)
  const bottomReserve = 70; // mm

  const outerLeft = marginLeft;
  const outerTop = marginTop;
  const outerWidth = pageWidth - marginLeft - marginRight;

  let currentY = outerTop + 4; // start inside outer border

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

  // ---------- helpers ----------
  const drawHeader = () => {
    // outer border for whole page
    doc.setDrawColor(0);
    doc.rect(outerLeft, outerTop, outerWidth, pageHeight - marginTop * 2);

    doc.setFont("times", "normal");
    doc.setFontSize(10);

    // top line: GSTIN, TAX INVOICE, Contact
    doc.text(`GST IN : ${company.gstin || ""}`, outerLeft + 2, currentY);

    const title = "TAX INVOICE";
    const titleWidth = doc.getTextWidth(title);
    doc.setFont("times", "bold");
    doc.text(
      title,
      outerLeft + outerWidth / 2 - titleWidth / 2,
      currentY
    );

    doc.setFont("times", "normal");
    const contactStr = `Contact No.: ${company.contact || ""}`;
    const contactWidth = doc.getTextWidth(contactStr);
    doc.text(
      contactStr,
      outerLeft + outerWidth - contactWidth - 2,
      currentY
    );

    currentY += 7;

    // firm name
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    const firmName = company.name || "";
    const firmWidth = doc.getTextWidth(firmName);
    doc.text(
      firmName,
      outerLeft + outerWidth / 2 - firmWidth / 2,
      currentY
    );

    currentY += 6;

    // deals in
    doc.setFontSize(10);
    doc.setFont("times", "normal");
    const dealsIn = `Deals in : ${company.dealsIn || ""}`;
    const dealsWidth = doc.getTextWidth(dealsIn);
    doc.text(
      dealsIn,
      outerLeft + outerWidth / 2 - dealsWidth / 2,
      currentY
    );

    currentY += 5;

    const addr = company.address || "";
    const addrWidth = doc.getTextWidth(addr);
    doc.text(
      addr,
      outerLeft + outerWidth / 2 - addrWidth / 2,
      currentY
    );

    currentY += 6;

    // Invoice No / Date row
    const rowHeight = 7;
    doc.rect(outerLeft, currentY - rowHeight + 1, outerWidth, rowHeight);
    const half = outerWidth / 2;

    doc.text(
      `Invoice No : ${invoiceNo || ""}`,
      outerLeft + 2,
      currentY
    );
    doc.text(
      `Date : ${date || ""}`,
      outerLeft + half + 2,
      currentY
    );

    currentY += rowHeight + 1;
  };

  const drawCustomerTransport = () => {
    const rowHeight = 28;
    const half = outerWidth * 0.65; // approx as in pad: 65% / 35%

    // big box
    doc.rect(outerLeft, currentY, outerWidth, rowHeight);

    // vertical split
    doc.line(outerLeft + half, currentY, outerLeft + half, currentY + rowHeight);

    // Customer block
    doc.setFont("times", "bold");
    doc.text("Customer Details:", outerLeft + 2, currentY + 5);
    doc.setFont("times", "normal");

    let lineY = currentY + 10;
    doc.text(`Name: ${customerName || ""}`, outerLeft + 2, lineY);
    lineY += 5;
    doc.text(`Address: ${customerAddress || ""}`, outerLeft + 2, lineY);
    lineY += 5;
    doc.text(`GSTIN No.: ${customerGstin || ""}`, outerLeft + 2, lineY);
    lineY += 5;
    doc.text(`State Code: ${stateCode || ""}`, outerLeft + 2, lineY);

    // Transport block
    doc.setFont("times", "bold");
    doc.text(
      "Transporter Details:",
      outerLeft + half + 2,
      currentY + 5
    );
    doc.setFont("times", "normal");
    doc.text(
      `Work Order No.: ${workOrderNo || ""}`,
      outerLeft + half + 2,
      currentY + 10
    );

    currentY += rowHeight + 2;
  };

  // ---------- start first page ----------
  drawHeader();
  drawCustomerTransport();

  // ---------- ITEMS TABLE (autoTable) ----------
  const tableStartY = currentY;

  const head = [
    [
      "Sl. No.",
      "DESCRIPTION OF SUPPLY",
      "HSN / SAC",
      "QTY.",
      "UNIT",
      "RATE / ITEM (₹)",
      "TAX %",
      "TAXABLE VALUE (₹)",
    ],
  ];

  const body = items.map((it, index) => {
    const qty = Number(it.qty || 0);
    const rate = Number(it.rate || 0);
    const amount = qty * rate;
    const unit = it.unit || "";
    const taxType = it.taxType || "CGST_SGST";
    let taxPercentStr = "";

    if (taxType === "IGST") {
      taxPercentStr = igstRate ? `${igstRate}%` : "";
    } else {
      const totalPct = Number(cgstRate || 0) + Number(sgstRate || 0);
      taxPercentStr = totalPct ? `${totalPct}%` : "";
    }

    return [
      String(index + 1),
      it.description || "",
      it.hsn || "",
      qty ? String(qty) : "",
      unit,
      rate ? rate.toLocaleString("en-IN") : "",
      taxPercentStr,
      amount ? amount.toLocaleString("en-IN") : "",
    ];
  });

  doc.setFontSize(9);
  doc.autoTable({
    head,
    body,
    startY: tableStartY,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 1.5,
    },
    headStyles: {
      fillColor: [247, 243, 207], // light yellow header
      textColor: 0,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 60 },
      2: { cellWidth: 18 },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 14, halign: "center" },
      7: { cellWidth: 24, halign: "right" },
    },
    didDrawPage: (data) => {
      // On each page, ensure the outer border is drawn
      if (data.pageNumber > 1) {
        // reset currentY when new page starts
        currentY = outerTop + 4;
        drawHeader();
        // move table down below header+customer on subsequent pages
        data.settings.startY = currentY + 30;
      }
    },
  });

  // where table ended
  const tableEndY = doc.lastAutoTable.finalY;

  currentY = tableEndY + 4;

  // Check if there is enough space for tax + bottom area, else new page
  const neededForBottom = 60; // approx mm
  if (currentY + neededForBottom > pageHeight - marginTop - 5) {
    doc.addPage();
    currentY = outerTop + 4;
    drawHeader();
    // small gap
    currentY += 6;
  }

  // ---------- Tax summary box ----------
  const taxBoxX = outerLeft;
  const taxBoxWidth = outerWidth;
  const lineH = 6;

  doc.setFont("times", "normal");
  doc.setFontSize(10);

  // border of tax box
  const taxLines = 6; // taxable + cgst + sgst + igst + total gst + grand total
  const taxBoxHeight = taxLines * lineH;
  doc.rect(taxBoxX, currentY, taxBoxWidth, taxBoxHeight);

  const drawTaxLine = (label, value, bold = false, offset) => {
    const y = currentY + lineH * offset - 1;
    if (bold) doc.setFont("times", "bold");
    else doc.setFont("times", "normal");

    doc.text(label, taxBoxX + 2, y);
    const valStr = value
      ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
      : "0";
    const textWidth = doc.getTextWidth(valStr);
    doc.text(
      valStr,
      taxBoxX + taxBoxWidth - textWidth - 2,
      y
    );
  };

  drawTaxLine("Taxable Amount", taxableAmount || 0, false, 1);
  drawTaxLine(`ADD CGST @ ${cgstRate || 0}%`, cgstAmount || 0, false, 2);
  drawTaxLine(`ADD SGST @ ${sgstRate || 0}%`, sgstAmount || 0, false, 3);
  drawTaxLine(`ADD IGST @ ${igstRate || 0}%`, igstAmount || 0, false, 4);
  drawTaxLine("Total GST", totalGst || 0, true, 5);
  drawTaxLine("GRAND TOTAL", grandTotal || 0, true, 6);

  currentY += taxBoxHeight + 4;

  // ---------- Amount in words ----------
  const wordsHeight = 8;
  doc.rect(taxBoxX, currentY, taxBoxWidth, wordsHeight);
  doc.setFont("times", "normal");
  doc.text(
    `Rupees: ${amountInWords || ""}`,
    taxBoxX + 2,
    currentY + 5
  );

  currentY += wordsHeight + 4;

  // If not enough space for bottom note/signature, add new page
  const bottomNeeded = 45;
  if (currentY + bottomNeeded > pageHeight - marginTop - 5) {
    doc.addPage();
    currentY = outerTop + 4;
    drawHeader();
    currentY += 6;
  }

  // ---------- Bottom Note + Bank + Signature ----------
  const bottomHeight = 35;
  const leftWidth = outerWidth * 0.7;
  const rightWidth = outerWidth - leftWidth;

  // outer bottom row
  doc.rect(outerLeft, currentY, outerWidth, bottomHeight);
  // vertical dividing line
  doc.line(
    outerLeft + leftWidth,
    currentY,
    outerLeft + leftWidth,
    currentY + bottomHeight
  );

  // left: Note + Bank
  doc.setFont("times", "bold");
  doc.text("Note :", outerLeft + 2, currentY + 5);
  doc.setFont("times", "normal");

  let noteY = currentY + 10;
  notes.forEach((n, idx) => {
    doc.text(`${idx + 1}. ${n}`, outerLeft + 5, noteY);
    noteY += 4;
  });

  doc.setFont("times", "bold");
  doc.text("Bank Details :", outerLeft + 2, noteY + 2);
  doc.setFont("times", "normal");
  doc.text(bankDetails || "", outerLeft + 5, noteY + 6);

  // right: For Raju Generator + signature
  doc.setFont("times", "bold");
  const forStr = `For ${company.name || ""}`;
  const forWidth = doc.getTextWidth(forStr);
  doc.text(
    forStr,
    outerLeft + leftWidth + rightWidth - forWidth - 2,
    currentY + 5
  );

  const signName = company.signatoryName || "";
  const signWidth = doc.getTextWidth(signName);

  doc.setFont("times", "normal");
  doc.text(
    signName,
    outerLeft + leftWidth + rightWidth - signWidth - 2,
    currentY + bottomHeight - 6
  );

  doc.setFontSize(9);
  const sigCaption = "Authorised Signatory";
  const sigCaptionWidth = doc.getTextWidth(sigCaption);
  doc.text(
    sigCaption,
    outerLeft + leftWidth + rightWidth - sigCaptionWidth - 2,
    currentY + bottomHeight - 2
  );

  // ---------- Save ----------
  const filename = `Invoice-${invoiceNo || "draft"}.pdf`;
  doc.save(filename);
}
