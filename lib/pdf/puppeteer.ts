// lib/pdf/puppeteer.ts
import chromium from "@sparticuz/chromium";
import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import type { PdfRenderer, PdfRequest, PdfResult } from "./index";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

function money(minor: number, cur = "USD") {
  return `${cur === "USD" ? "US$" : ""}${(Number(minor || 0) / 100).toFixed(2)}`;
}

function getLocalBrowserPath(): string | undefined {
  const commonPaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.CHROME_EXECUTABLE_PATH,
  ];

  if (process.env.LOCALAPPDATA) {
    commonPaths.push(`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`);
    commonPaths.push(`${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`);
  }

  for (const p of commonPaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

export class PuppeteerRenderer implements PdfRenderer {
  async render(req: PdfRequest): Promise<PdfResult> {
    const quote = await prisma.quote.findUnique({
      where: { id: req.quoteId },
      include: { customer: true, lines: { orderBy: { id: "asc" } } },
    });
    if (!quote) throw new Error("Quote not found");

    const vatPct = Number(quote.vatBps ?? 0) / 100;
    const currency = quote.currency ?? "USD";

    // Read logo
    const logoPath = path.join(process.cwd(), "public", "barmlo_logo.jpeg");
    let logoBase64 = "";
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString("base64")}`;
    }

    // Group lines
    type LineGroup = { section: string; rows: any[]; subtotal: number };
    const groups: Record<string, LineGroup> = {};
    const groupOrder: string[] = [];

    for (const line of quote.lines) {
      let meta: any = {};
      try {
        meta = JSON.parse(line.metaJson ?? "{}");
      } catch {}
      
      const section = meta.section?.trim() || "Items";
      if (!groups[section]) {
        groups[section] = { section, rows: [], subtotal: 0 };
        groupOrder.push(section);
      }
      
      const qty = Number(line.quantity || 0);
      const amt = Number(line.lineTotalMinor || 0);
      groups[section].rows.push({ ...line, qty, amt, unit: meta.unit || line.unit });
      groups[section].subtotal += amt;
    }

    // Calculate totals
    const subtotal = quote.lines.reduce((sum, l) => sum + Number(l.lineTotalMinor || 0), 0);
    const vat = Math.round(subtotal * vatPct / 100); // Approximate if not stored
    // Ideally use stored totals if available in metaJson, but recalculating is safer for display if missing
    let grandTotal = subtotal; // If VAT is included or excluded depends on logic, assuming simple add for now
    // Actually page.tsx uses derived totals. Let's trust line totals sum for subtotal.
    // page.tsx: const vatPercent = fromMinor(quote.vatBps) / 100;
    // computedTotals.tax = subtotal * vatPercent ...
    const taxAmount = subtotal * (vatPct / 100);
    grandTotal = subtotal + taxAmount;


    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Quote ${quote.number || quote.id}</title>
  <style>
    @page { margin: 15mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: #1f2937; margin: 0; }
    
    /* Utilities */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-row { flex-direction: row; }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-between { justify-content: space-between; }
    .justify-end { justify-content: flex-end; }
    .gap-2 { gap: 0.5rem; }
    .gap-4 { gap: 1rem; }
    .gap-8 { gap: 2rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-8 { margin-bottom: 2rem; }
    .mt-4 { margin-top: 1rem; }
    .p-2 { padding: 0.5rem; }
    .p-4 { padding: 1rem; }
    .p-8 { padding: 2rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    
    .font-bold { font-weight: 700; }
    .font-medium { font-weight: 500; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    
    /* Colors */
    .text-white { color: #fff; }
    .text-gray-500 { color: #6b7280; }
    .text-gray-700 { color: #374151; }
    .text-blue-900 { color: #1e3a8a; }
    .text-orange-500 { color: #f97316; }
    
    .bg-white { background-color: #fff; }
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-blue-100 { background-color: #dbeafe; }
    .bg-blue-900 { background-color: #1e3a8a; }
    
    .border { border-width: 1px; border-style: solid; }
    .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
    .border-r { border-right-width: 1px; border-right-style: solid; }
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-300 { border-color: #d1d5db; }
    .border-blue-100 { border-color: #dbeafe; }
    
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    
    .w-full { width: 100%; }
    .w-48 { width: 12rem; }
    .h-24 { height: 6rem; }
    .h-0.5 { height: 0.125rem; }
    
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    
    .object-contain { object-fit: contain; }
    
    /* Table specific */
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; font-weight: 500; letter-spacing: 0.05em; }
    
    /* Helpers */
    .logo-img { max-width: 100%; max-height: 100%; }
  </style>
</head>
<body>
  <div class="bg-white border border-gray-200 rounded-lg" style="border: none;">
    
    <!-- Top Section: Logo & Contact -->
    <div class="flex justify-between items-start mb-6">
      <div class="flex flex-col items-start">
        <div class="w-48 h-24 mb-2 relative">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img object-contain" alt="Barmlo Logo" />` : '<div style="background:#eee;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">Logo</div>'}
        </div>
        <p class="text-orange-500 italic font-medium text-sm">Your happiness is our pride</p>
      </div>

      <div class="flex flex-col gap-2 text-sm text-blue-900 text-right items-end">
        <div class="flex items-center gap-2 justify-end">
          <span class="font-bold italic">+263782939350, +263787555007</span>
        </div>
        <div class="flex items-center gap-2 justify-end">
          <span class="font-bold italic">132 J Chinamano Ave Harare</span>
        </div>
        <div class="flex items-center gap-2 justify-end">
          <span class="font-bold italic">info@barmlo.co.zw</span>
        </div>
        <div class="flex items-center gap-2 justify-end">
          <span class="font-bold italic">www.barmlo.co.zw</span>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="w-full h-0.5 bg-blue-900 mb-4"></div>

    <!-- TIN / Vendor & Title -->
    <div class="flex justify-between items-start mb-8">
      <div class="text-sm font-bold text-gray-700">
        <p style="margin:0 0 4px">TIN NO: 2000873176</p>
        <p style="margin:0">VENDOR NO: 718689</p>
      </div>
      <div>
        <h2 class="text-3xl font-bold text-gray-500 uppercase" style="letter-spacing: 0.05em; margin: 0;">QUOTATION</h2>
      </div>
    </div>

    <!-- Info Boxes -->
    <div class="grid grid-cols-2 gap-8 mb-8">
      <!-- Customer Info -->
      <div class="border border-gray-300">
        <div class="bg-blue-100 px-2 py-1 border-b border-gray-300 font-bold text-gray-700 text-sm" style="background-color: rgba(219, 234, 254, 0.5);">CUSTOMER INFO</div>
        <div class="p-2 text-sm">
          <p style="margin:0 0 4px"><span class="font-bold text-gray-700">Name:</span> ${quote.customer?.displayName ?? ""}</p>
          <p style="margin:0 0 4px"><span class="font-bold text-gray-700">Address:</span> ${quote.customer?.city || 'Harare'}</p>
          <p style="margin:0 0 4px"><span class="font-bold text-gray-700">Phone, E-mail:</span> ${quote.customer?.phone || quote.customer?.email || '-'}</p>
          <p style="margin:0"><span class="font-bold text-gray-700">Ref:</span> ${quote.description || 'PROPOSED HOUSE CONSTRUCTION'}</p>
        </div>
      </div>

      <!-- Quote Details -->
      <div class="border border-gray-300">
        <div class="grid grid-cols-2 border-b border-gray-300 text-center font-bold text-gray-700 text-sm" style="background-color: rgba(219, 234, 254, 0.5);">
          <div class="px-2 py-1 border-r border-gray-300">QUOTE #</div>
          <div class="px-2 py-1">DATE</div>
        </div>
        <div class="grid grid-cols-2 border-b border-gray-300 text-center text-sm">
          <div class="px-2 py-1 border-r border-gray-300">${quote.number || quote.id.slice(0, 8)}</div>
          <div class="px-2 py-1">${new Date(quote.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="grid grid-cols-2 border-b border-gray-300 text-center font-bold text-gray-700 text-sm" style="background-color: rgba(219, 234, 254, 0.5);">
          <div class="px-2 py-1 border-r border-gray-300">CUSTOMER ID</div>
          <div class="px-2 py-1">VALID UNTIL</div>
        </div>
        <div class="grid grid-cols-2 text-center text-sm">
          <div class="px-2 py-1 border-r border-gray-300">${quote.customer?.id.slice(0, 5) || 'CUST01'}</div>
          <div class="px-2 py-1">${new Date(new Date(quote.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
        </div>
      </div>
    </div>

    <!-- Line Items -->
    <div style="display: flex; flex-direction: column; gap: 2rem;">
      ${groupOrder.map(section => {
        const group = groups[section];
        return `
        <div>
          <div class="rounded-xl bg-blue-50 p-4 border border-blue-100 flex items-center gap-3 mb-4">
             <h3 class="font-bold text-blue-900 uppercase text-sm" style="letter-spacing: 0.05em; margin:0;">${section}</h3>
          </div>
          
          <div class="border border-gray-200 rounded-xl overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left w-12">#</th>
                  <th class="px-4 py-3 text-left">Description</th>
                  <th class="px-4 py-3 text-center w-24">Unit</th>
                  <th class="px-4 py-3 text-right w-24">Qty</th>
                  <th class="px-4 py-3 text-right w-64">Rate</th>
                  <th class="px-4 py-3 text-right w-32">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${group.rows.map((row, idx) => `
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td class="px-4 py-3 text-sm text-gray-500">${idx + 1}</td>
                  <td class="px-4 py-3 text-sm font-medium text-gray-700">
                    <div>${row.description || ""}</div>
                  </td>
                  <td class="px-4 py-3 text-center text-sm text-gray-500">${row.unit || ""}</td>
                  <td class="px-4 py-3 text-right text-sm text-gray-900">${row.qty.toFixed(2)}</td>
                  <td class="px-4 py-3 text-right text-sm text-gray-900">
                    ${money(row.unitPriceMinor || 0, currency)}
                  </td>
                  <td class="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    ${money(row.amt, currency)}
                  </td>
                </tr>
                `).join("")}
              </tbody>
              <tfoot class="bg-gray-50">
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td colspan="5" class="px-4 py-3 text-right text-sm font-medium text-gray-900">Section Subtotal</td>
                  <td class="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    ${money(group.subtotal, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        `;
      }).join("")}
    </div>

    <!-- Grand Totals -->
    <div class="flex justify-end mt-8">
      <div class="w-48">
        <div class="flex justify-between py-2 text-sm">
          <span class="font-medium text-gray-700">Subtotal</span>
          <span class="font-bold text-gray-900">${money(subtotal, currency)}</span>
        </div>
        <div class="flex justify-between py-2 text-sm">
          <span class="font-medium text-gray-700">VAT (${vatPct}%)</span>
          <span class="font-bold text-gray-900">${money(taxAmount, currency)}</span>
        </div>
        <div class="flex justify-between py-2 text-lg border-t border-gray-300 mt-2 pt-2">
          <span class="font-bold text-gray-900">Total</span>
          <span class="font-bold text-blue-900">${money(grandTotal, currency)}</span>
        </div>
      </div>
    </div>
    
  </div>
</body>
</html>`;

    // Launch Chromium (works locally & on Vercel)
    const isServerless = !!process.env.VERCEL;
    let executablePath = isServerless
      ? await chromium.executablePath()
      : getLocalBrowserPath();

    if (!executablePath && !isServerless) {
      console.warn("Could not find local Chrome/Edge. PDF generation might fail. Please install Chrome or set CHROME_EXECUTABLE_PATH.");
    }

    const browser: Browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      headless: true,
      executablePath,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfUint8 = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "12mm", left: "10mm" },
      });
      const buffer = Buffer.from(pdfUint8);

      const customerName = quote.customer?.displayName || "Customer";
      const sanitizedCustomerName = customerName.replace(/[^a-z0-9\-_]/gi, '_');
      
      let filename = `${sanitizedCustomerName}_Quotation`;
      if (quote.number) {
        filename += `_${quote.number}`;
      }
      filename += ".pdf";

      return { buffer, filename };
    } finally {
      await browser.close();
    }
  }
}
