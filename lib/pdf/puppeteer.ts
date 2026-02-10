
import chromium from "@sparticuz/chromium";
import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import type { PdfRenderer, PdfRequest, PdfResult } from "./index";
import { BARMLO_LOGO_BASE64 } from "./logo";
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
      include: { customer: true, project: true, lines: { orderBy: { id: "asc" } } },
    });
    if (!quote) throw new Error("Quote not found");

    // Fix VAT: If bps < 100, assume it's a percentage (15 = 15%) => 1500 bps
    const qtVatBps = Number(quote.vatBps || 0);
    const effectiveVatBps = (qtVatBps > 0 && qtVatBps < 100)
      ? qtVatBps * 100
      : qtVatBps;
    const vatPct = effectiveVatBps / 100; // e.g. 1500 -> 15%

    // Logic for notes
    const assumptions = quote.assumptions ? JSON.parse(quote.assumptions as string) : [];
    const exclusions = quote.exclusions ? JSON.parse(quote.exclusions as string) : [];

    const currency = quote.currency ?? "USD";

    // Read logo
    const logoPath = path.join(process.cwd(), "public", "barmlo_logo.png");
    let logoBase64 = BARMLO_LOGO_BASE64;
    // Try to read from FS if possible, otherwise use fallback
    if (fs.existsSync(logoPath)) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      } catch (e) {
        console.error("Failed to read logo file, using fallback", e);
      }
    } else {
      // Use hardcoded fallback if file not found (Production fix)
      logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."; // FULL BASE64 STRING HERE
    }

    // Group lines
    type LineGroup = { section: string; rows: any[]; subtotal: number };
    const groups: Record<string, LineGroup> = {};
    const groupOrder: string[] = [];

    // Separate labour vs materials for summary
    let totalLabour = 0;
    let totalMaterials = 0;

    for (const line of quote.lines) {
      let meta: any = {};
      try {
        meta = JSON.parse(line.metaJson ?? "{}");
      } catch { }

      const section = meta.section?.trim() || "Items";
      if (!groups[section]) {
        groups[section] = { section, rows: [], subtotal: 0 };
        groupOrder.push(section);
      }

      const qty = Number(line.quantity || 0);
      const amt = Number(line.lineTotalMinor || 0);
      groups[section].rows.push({ ...line, qty, amt, unit: meta.unit || line.unit });
      groups[section].subtotal += amt;

      const itemType = line.itemType || 'MATERIAL';
      if (itemType === 'LABOUR') {
        totalLabour += amt;
      } else {
        totalMaterials += amt;
      }
    }

    // Sort groups
    const orderMap: Record<string, number> = {
      'FOUNDATIONS': 1,
      'SUPERSTRUCTURE BRICKWORK': 2,
      'ROOF COVERINGS': 3,
      'PLASTERING': 4,
      'SCREEDS': 5,
      'ELECTRICALS TUBING': 6,
      'MATERIALS': 90,
      'LABOUR': 91,
      'FIX_SUPPLY': 92
    };
    groupOrder.sort((a, b) => (orderMap[a] || 99) - (orderMap[b] || 99));

    // Calculate totals matching QuoteDoc.tsx logic
    const baseTotal = totalLabour + totalMaterials;
    const pgAmount = (baseTotal * (Number(quote.pgRate) || 0)) / 100;

    // Excel Logic Match: Contingency is based on P&G amount, not the subtotal
    // Excel: = (P&G * 10%)
    const contingencyAmount = (pgAmount * (Number(quote.contingencyRate) || 0)) / 100;

    const subtotal2 = baseTotal + pgAmount + contingencyAmount;
    const taxAmount = subtotal2 * (effectiveVatBps / 10000);
    const grandTotal = subtotal2 + taxAmount;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
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
    .w-64 { width: 16rem; }
    .h-32 { height: 8rem; }
    .h-0.5 { height: 0.125rem; }
    .w-10 { width: 2.5rem; }
    .w-16 { width: 4rem; }
    .w-24 { width: 6rem; }
    .w-28 { width: 7rem; }
    
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    
    .object-contain { object-fit: contain; }

    /* Table specific */
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; font-weight: 500; letter-spacing: 0.05em; }

    /* Helpers */
    .logo-img { max-width: 100%; max-height: 100%; }
    
    /* Notes */
    .notes-container { margin-top: 2rem; padding: 1rem; background-color: #f9fafb; border-radius: 0.5rem; }
    .note-item { display: flex; margin-bottom: 0.25rem; font-size: 0.75rem; color: #4b5563; }
    .bullet { width: 1.5rem; text-align: center; }
  </style>
</head>
<body>
  <div class="bg-white" style="border: none;">
    <!-- Top Section: Logo & Contact -->
    <div class="flex justify-between items-start mb-6">
      <div class="flex flex-col items-start">
        <div class="w-64 h-32 mb-2 relative">
          ${logoBase64 ? `<img src="${logoBase64}" class="logo-img object-contain" alt="Barmlo Logo" />` : '<div style="background:#eee;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">Logo</div>'}
        </div>
      </div>

      <div class="flex flex-col gap-2 text-sm text-blue-900 text-right items-end">
        <div class="flex items-center gap-2 justify-end">
          <span class="font-bold italic">+263 782 939 350, +263 787 555 007</span>
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
          <p style="margin:0 0 4px"><span class="font-bold text-gray-700">Name:</span> ${quote.customer?.displayName || ""}</p>
          <p style="margin:0 0 4px"><span class="font-bold text-gray-700">Address:</span> ${quote.customer?.city || 'Harare'}</p>
          <p style="margin:0 0 4px"><span class="font-bold text-gray-700">Phone/Email:</span> ${quote.customer?.phone || quote.customer?.email || '-'}</p>
          <p style="margin:0"><span class="font-bold text-gray-700">Ref:</span> ${(quote as any).project?.name || 'PROPOSED HOUSE'}</p>
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
                  <th class="px-2 py-3 text-left w-10">#</th>
                  <th class="px-2 py-3 text-left">Description</th>
                  <th class="px-2 py-3 text-center w-16">Unit</th>
                  <th class="px-2 py-3 text-right w-16">Qty</th>
                  <th class="px-2 py-3 text-right w-24">Rate</th>
                  <th class="px-2 py-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                ${group.rows.map((row, idx) => `
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td class="px-2 py-3 text-sm text-gray-500">${idx + 1}</td>
                  <td class="px-2 py-3 text-sm font-medium text-gray-700">
                    <div>${row.description || ""}</div>
                  </td>
                  <td class="px-2 py-3 text-center text-sm text-gray-500">${row.unit || ""}</td>
                  <td class="px-2 py-3 text-right text-sm text-gray-900">${row.qty.toFixed(2)}</td>
                  <td class="px-2 py-3 text-right text-sm text-gray-900">
                    ${money(row.unitPriceMinor || 0, currency)}
                  </td>
                  <td class="px-2 py-3 text-right text-sm font-bold text-gray-900">
                    ${money(row.amt, currency)}
                  </td>
                </tr>
                `).join("")}
              </tbody>
              <tfoot class="bg-gray-50">
                <tr style="border-top: 1px solid #e5e7eb;">
                  <td colspan="5" class="px-2 py-3 text-right text-sm font-medium text-gray-900">Section Subtotal</td>
                  <td class="px-2 py-3 text-right text-sm font-bold text-gray-900">
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

    <!-- Grand Totals Summary & Notes -->
    <div class="mt-8">
      
      <!-- Top Level Totals (Labour/Material) -->
      <div class="flex justify-end mb-8">
        <div class="w-1/2">
           <div class="flex justify-between py-1 text-sm">
             <span class="font-bold text-gray-700">TOTAL LABOUR</span>
             <span class="font-bold text-gray-900">${money(totalLabour, currency)}</span>
           </div>
           <div class="flex justify-between py-1 text-sm">
             <span class="font-bold text-gray-700">TOTAL MATERIALS</span>
             <span class="font-bold text-gray-900">${money(totalMaterials, currency)}</span>
           </div>
           <div class="flex justify-between py-1 text-sm border-t border-gray-300 mt-1 pt-1">
             <span class="font-bold text-blue-900">TOTAL FIX AND SUPPLY</span>
             <span class="font-bold text-blue-900">${money(baseTotal, currency)}</span>
           </div>
        </div>
      </div>

      <!-- Construction Cost Summary Table -->
      <div class="mb-8">
        <h4 class="font-bold text-gray-700 text-sm mb-3 uppercase">CONSTRUCTION COST SUMMARY</h4>
        <table class="w-full border border-gray-300">
           <thead>
             <tr class="border-b border-gray-300 text-gray-500">
               <th class="px-4 py-2 text-center border-r border-gray-300 w-16 font-medium">ITEM</th>
               <th class="px-4 py-2 text-left border-r border-gray-300 font-medium">DESCRIPTION</th>
               <th class="px-4 py-2 text-right w-48 font-medium">AMOUNT</th>
             </tr>
           </thead>
           <tbody>
             ${groupOrder.map((section, idx) => `
             <tr class="border-b border-gray-300">
               <td class="px-4 py-2 text-center text-sm text-gray-500 border-r border-gray-300">${idx + 1}</td>
               <td class="px-4 py-2 text-sm text-gray-700 border-r border-gray-300 uppercase">${section}</td>
               <td class="px-4 py-2 text-right text-sm text-gray-900">${money(groups[section].subtotal, currency)}</td>
             </tr>
             `).join("")}
             
             <!-- Totals Row -->
             <tr class="bg-gray-50 border-t-2 border-gray-300">
               <td colspan="2" class="px-4 py-2 text-right text-sm text-gray-700 border-r border-gray-300 font-bold uppercase">TOTAL MEASURED WORKS</td>
               <td class="px-4 py-2 text-right text-sm text-gray-900 font-bold">${money(baseTotal, currency)}</td>
             </tr>

             ${Number(quote.pgRate) > 0 ? `
             <tr class="border-b border-gray-300">
               <td colspan="2" class="px-4 py-2 text-right text-sm text-gray-700 border-r border-gray-300">ADD P&Gs (${quote.pgRate}%)</td>
               <td class="px-4 py-2 text-right text-sm text-gray-900">${money(pgAmount, currency)}</td>
             </tr>` : ''}

             ${Number(quote.contingencyRate) > 0 ? `
             <tr class="border-b border-gray-300">
               <td colspan="2" class="px-4 py-2 text-right text-sm text-gray-700 border-r border-gray-300">ADD CONTINGENCY (${quote.contingencyRate}%)</td>
               <td class="px-4 py-2 text-right text-sm text-gray-900">${money(contingencyAmount, currency)}</td>
             </tr>` : ''}

             <tr class="border-b border-gray-300">
               <td colspan="2" class="px-4 py-2 text-right text-sm text-gray-700 border-r border-gray-300">ADD VAT (${vatPct.toFixed(1)}%)</td>
               <td class="px-4 py-2 text-right text-sm text-gray-900">${money(taxAmount, currency)}</td>
             </tr>

             <tr class="bg-blue-900 text-white font-bold">
               <td colspan="2" class="px-4 py-2 text-right text-sm uppercase border-r border-blue-800">GRAND TOTAL</td>
               <td class="px-4 py-2 text-right text-sm">${money(grandTotal, currency)}</td>
             </tr>
           </tbody>
        </table>
      </div>

    <!-- Notes Section -->
    ${(assumptions.length > 0 || exclusions.length > 0) ? `
    <div class="notes-container border-0 bg-white p-0 mt-4 page-break-inside-avoid">
      <h4 class="font-bold text-gray-700 text-sm mb-4 uppercase underline">NOTES</h4>
      
      ${assumptions.length > 0 ? `
        <div class="mb-4">
          <div class="flex gap-2 mb-2">
            <span class="font-bold text-sm text-gray-700">1)</span>
            <span class="font-bold text-sm text-gray-700 uppercase">Assumptions & Conditions:</span>
          </div>
          <div class="pl-6 text-sm text-gray-600">
            ${assumptions.map((n: string) => `
              <div class="mb-2 leading-relaxed">
                ${n
        .replace(/(\s|^)(\d+\))/g, '<br/><br/><span class="font-bold text-gray-700">$2</span>')
        .replace(/(\s|^)([a-z]\))/g, '<br/><span style="display:inline-block; margin-left: 24px;">$2</span>')
        .replace(/(\s|^)(\d+\.\s)/g, '<br/><span style="display:inline-block; margin-left: 24px;">$2</span>')
      }
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}

      ${exclusions.length > 0 ? `
        <div>
          <div class="flex gap-2 mb-2">
            <span class="font-bold text-sm text-gray-700">${assumptions.length > 0 ? '2' : '1'})</span>
            <span class="font-bold text-sm text-gray-700 uppercase">Exclusions:</span>
          </div>
           <div class="pl-6 text-sm text-gray-600">
            ${exclusions.map((n: string) => `
              <div class="mb-2 leading-relaxed">
                ${n
          .replace(/(\s|^)(\d+\))/g, '<br/><br/><span class="font-bold text-gray-700">$2</span>')
          .replace(/(\s|^)([a-z]\))/g, '<br/><span style="display:inline-block; margin-left: 24px;">$2</span>')
          .replace(/(\s|^)(\d+\.\s)/g, '<br/><span style="display:inline-block; margin-left: 24px;">$2</span>')
        }
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}
    </div>
    ` : ''}
    </div>

    <div class="mt-8 mb-8"></div>
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
