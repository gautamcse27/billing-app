// src/invoicePdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generate A4 multi-page PDF for the invoice and open it in a new window.
 */
export function exportInvoicePdf(invoice) {
  console.log("Exporting invoice PDF", invoice);

  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 10;
  const marginRight = 10;
  const contentWidth = pageWidth - marginLeft - marginRight;

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

  const signatureDataUrl = company?.signatureDataUrl;

  // ---------- HEADER ----------
  let y = 12;

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`GST IN : ${company.gstin || ""}`, marginLeft, y);

  doc.setFont("times", "bold");
  doc.text("TAX INVOICE", pageWidth / 2, y, { align: "center" });

  doc.setFont("times", "normal");
  const contactStr = `Contact No.: ${company.contact || ""}`;
  const contactWidth = doc.getTextWidth(contactStr);
  doc.text(contactStr, pageWidth - marginRight - contactWidth, y);

  y += 8;

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text(company.name || "", pageWidth / 2, y, { align: "center" });

  y += 6;
  doc.setFontSize(10);
  doc.setFont("times", "normal");
  doc.text(
    `Deals in : ${company.dealsIn || ""}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 5;
  doc.text(
    company.address || "",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  y += 7;

  // Invoice No / Date line
  doc.setFont("times", "normal");
  doc.text(`Invoice No : ${invoiceNo || ""}`, marginLeft, y);
  doc.text(
    `Date : ${date || ""}`,
    pageWidth - marginRight,
    y,
    { align: "right" }
  );

  y += 5;

  // ---------- CUSTOMER / TRANSPORT BLOCK ----------
  const blockHeight = 25;
  const midX = marginLeft + contentWidth * 0.65;

  // outer rect
  doc.rect(marginLeft, y, contentWidth, blockHeight);
  // vertical split
  doc.line(midX, y, midX, y + blockHeight);

  doc.setFont("times", "bold");
  doc.text("Customer Details:", marginLeft + 2, y + 5);

  doc.setFont("times", "normal");
  let lineY = y + 10;
  doc.text(`Name: ${customerName || ""}`, marginLeft + 2, lineY);
  lineY += 4;
  doc.text(`Address: ${customerAddress || ""}`, marginLeft + 2, lineY);
  lineY += 4;
  doc.text(`GSTIN No.: ${customerGstin || ""}`, marginLeft + 2, lineY);
  lineY += 4;
  doc.text(`State Code: ${stateCode || ""}`, marginLeft + 2, lineY);

  doc.setFont("times", "bold");
  doc.text("Transporter Details:", midX + 2, y + 5);
  doc.setFont("times", "normal");
  doc.text(`Work Order No.: ${workOrderNo || ""}`, midX + 2, y + 10);

  y += blockHeight + 4;

  // ---------- ITEMS TABLE ----------
  const head = [
    [
      "Sl. No.",
      "DESCRIPTION OF SUPPLY",
      "HSN / SAC",
      "QTY.",
      "UNIT",
      "RATE / ITEM",
      "TAX Rate",
      "TAX Type",
      "TAXABLE VALUE",
      "TAX Amount",
      "TOTAL Amount",
    ],
  ];

  const body = items.map((it, index) => {
    const qty = Number(it.qty || 0);
    const rate = Number(it.rate || 0);
    const amount = qty * rate;
    const unit = it.unit || "";
    const taxType = it.taxType || "CGST_SGST";

    let taxRate = 0;
    if (taxType === "IGST") {
      taxRate = Number(igstRate || 0);
    } else {
      taxRate = Number(cgstRate || 0) + Number(sgstRate || 0);
    }

    const taxAmount = (amount * taxRate) / 100;
    const totalAmount = amount + taxAmount;

    return [
      String(index + 1),
      it.description || "",
      it.hsn || "",
      qty ? String(qty) : "",
      unit,
      rate ? rate.toLocaleString("en-IN") : "",
      taxRate ? `${taxRate}%` : "",
      taxType === "IGST" ? "IGST" : "CGST + SGST",
      amount ? amount.toLocaleString("en-IN") : "",
      taxAmount ? taxAmount.toLocaleString("en-IN") : "",
      totalAmount ? totalAmount.toLocaleString("en-IN") : "",
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y,
    theme: "grid",
    styles: {
      font: "times",
      fontSize: 9,
      cellPadding: 1.5,
    },
    headStyles: {
      fillColor: [247, 243, 207],
      textColor: 0,
      halign: "center",
    },
    // make table exactly as wide as content box
    margin: { left: marginLeft, right: marginRight },
    tableWidth: contentWidth,
    columnStyles: {
      0: { halign: "center" }, // Sl. No.
      2: { halign: "center" }, // HSN/SAC
      3: { halign: "center" }, // QTY.
      4: { halign: "center" }, // UNIT
      5: { halign: "right" },  // Rate
      6: { halign: "center" }, // Tax Rate
      7: { halign: "center" }, // Tax Type
      8: { halign: "right" },  // Taxable
      9: { halign: "right" },  // Tax Amount
      10: { halign: "right" }, // Total Amount
    },
  });

  let tableEndY = doc.lastAutoTable.finalY || y + 10;
  let currentY = tableEndY + 6;
  const pageHeight = doc.internal.pageSize.getHeight();

  // If not enough space for tax + notes, add new page
  const bottomNeeded = 70;
  if (currentY + bottomNeeded > pageHeight - 10) {
    doc.addPage();
    currentY = 15;
  }

  // ---------- TAX SUMMARY ----------
  const lineH = 6;
  const taxLines = 6;
  const taxBoxHeight = taxLines * lineH;
  const taxX = marginLeft;

  const drawTaxLine = (label, value, offset, bold = false) => {
    const yPos = currentY + lineH * offset - 1;
    doc.setFont("times", bold ? "bold" : "normal");
    doc.text(label, taxX + 2, yPos);
    const valStr = (value ?? 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
    const w = doc.getTextWidth(valStr);
    doc.text(valStr, marginLeft + contentWidth - w - 2, yPos);
  };

  // border
  doc.rect(taxX, currentY, contentWidth, taxBoxHeight);

  drawTaxLine("Taxable Amount", taxableAmount || 0, 1);
  drawTaxLine(`ADD CGST @ ${cgstRate || 0}%`, cgstAmount || 0, 2);
  drawTaxLine(`ADD SGST @ ${sgstRate || 0}%`, sgstAmount || 0, 3);
  drawTaxLine(`ADD IGST @ ${igstRate || 0}%`, igstAmount || 0, 4);
  drawTaxLine("Total GST", totalGst || 0, 5, true);
  drawTaxLine("GRAND TOTAL", grandTotal || 0, 6, true);

  currentY += taxBoxHeight + 4;

  // ---------- AMOUNT IN WORDS ----------
  const wordsH = 8;
  doc.rect(taxX, currentY, contentWidth, wordsH);
  doc.setFont("times", "normal");
  doc.text(
    `Rupees: ${amountInWords || ""}`,
    taxX + 2,
    currentY + 5
  );

  currentY += wordsH + 4;

  // If bottom block won’t fit, new page
  if (currentY + 40 > pageHeight - 10) {
    doc.addPage();
    currentY = 15;
  }

  // ---------- BOTTOM: NOTE + BANK + SIGNATURE ----------
  const bottomHeight = 35;
  const leftWidth = contentWidth * 0.7;
  const rightWidth = contentWidth - leftWidth;

  doc.rect(marginLeft, currentY, contentWidth, bottomHeight);
  doc.line(
    marginLeft + leftWidth,
    currentY,
    marginLeft + leftWidth,
    currentY + bottomHeight
  );

  // left
  doc.setFont("times", "bold");
  doc.text("Note :", marginLeft + 2, currentY + 5);
  doc.setFont("times", "normal");

  let noteY = currentY + 10;
  (notes || []).forEach((n, idx) => {
    doc.text(`${idx + 1}. ${n}`, marginLeft + 5, noteY);
    noteY += 4;
  });

  doc.setFont("times", "bold");
  doc.text("Bank Details :", marginLeft + 2, noteY + 2);
  doc.setFont("times", "normal");
  doc.text(bankDetails || "", marginLeft + 5, noteY + 6);

  // right
  doc.setFont("times", "bold");
  const forStr = `For ${company.name || ""}`;
  const forW = doc.getTextWidth(forStr);
  doc.text(
    forStr,
    marginLeft + leftWidth + rightWidth - forW - 2,
    currentY + 5
  );

  // signature image (if any)
  if (signatureDataUrl) {
    try {
      const imgWidth = 30;
      const imgHeight = 12;
      const imgX = marginLeft + leftWidth + rightWidth - imgWidth - 4;
      const imgY = currentY + bottomHeight - imgHeight - 8;
      doc.addImage(signatureDataUrl, "JPEG", imgX, imgY, imgWidth, imgHeight);
    } catch (e) {
      console.error("Error adding signature image", e);
    }
  } else if (company.signatoryName) {
    // fallback to text name
    const signName = company.signatoryName || "";
    const signW = doc.getTextWidth(signName);
    doc.setFont("times", "normal");
    doc.text(
      signName,
      marginLeft + leftWidth + rightWidth - signW - 2,
      currentY + bottomHeight - 6
    );
  }

  const cap = "Authorised Signatory";
  const capW = doc.getTextWidth(cap);
  doc.setFontSize(9);
  doc.text(
    cap,
    marginLeft + leftWidth + rightWidth - capW - 2,
    currentY + bottomHeight - 2
  );

  // ---------- Open PDF in new window ----------
  try {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      alert("Popup blocked. Please allow popups to see the PDF.");
    }
  } catch (err) {
    console.error("Error exporting PDF", err);
    alert("Error exporting PDF: " + err.message);
  }
}
