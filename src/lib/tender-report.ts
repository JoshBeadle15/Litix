import * as XLSX from "xlsx";

/**
 * Parser for the POS's "Sales by Tender - Summary" report export.
 *
 * Unlike the manufacturer report, this one actually has real dollar figures
 * (Gross, Refund, Discount, Net) — it's organized as one block per tender
 * type (Cash, Check, Credit Card, ...), each block broken into subsections
 * (Sales, Services, and occasionally extra ones like "Digital Subscriptions"
 * or "Rentals") with a department-coded line per subsection, followed by
 * admin subsections we don't need (Revenue/Tax/Buyback/Location Total) and a
 * "Tender Types" subsection whose one data row is the clean, full-precision
 * grand total for that tender — the per-tender "Totals" label rows elsewhere
 * in the file are truncated by the report tool's own column-width overflow
 * (confirmed: e.g. "$471,629." with digits cut off, and even a tender NAME
 * cut short to "WPS Bursar Billing (Financial ") and are skipped entirely.
 *
 * Because tender names aren't declared up front and can themselves be
 * truncated in that one row, a tender-name row is identified structurally
 * instead of by text: it's always the lone label immediately followed by
 * the "Dept / Type" column header, which reprints on every page right after
 * the tender name (new or repeated) and nowhere else. That's reliable even
 * when the later "Tender Types" row for the same tender is truncated.
 */

export interface TenderTotalRow {
  tender: string;
  gross: number;
  saleQty: number;
  refund: number;
  refQty: number;
  discount: number;
  net: number;
}

export interface DepartmentRevenueRow {
  tender: string;
  department: string;
  gross: number;
  saleQty: number;
  refund: number;
  refQty: number;
  discount: number;
  net: number;
}

export interface TenderImportMeta {
  filename: string;
  importedAt: string;
  rowCount: number;
  skippedCount: number;
}

interface TenderStore {
  tenderTotals: TenderTotalRow[];
  departmentRows: DepartmentRevenueRow[];
  lastImport: TenderImportMeta | null;
}

const STORAGE_KEY = "litlx:tenderRevenue:v1";

export function loadTenderStore(): TenderStore {
  if (typeof window === "undefined")
    return { tenderTotals: [], departmentRows: [], lastImport: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tenderTotals: [], departmentRows: [], lastImport: null };
    const parsed = JSON.parse(raw);
    return {
      tenderTotals: parsed.tenderTotals ?? [],
      departmentRows: parsed.departmentRows ?? [],
      lastImport: parsed.lastImport ?? null,
    };
  } catch {
    return { tenderTotals: [], departmentRows: [], lastImport: null };
  }
}

export function saveTenderStore(store: TenderStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // storage unavailable (private mode, quota) — imported data just won't persist across reloads
  }
}

const ADMIN_LABELS = new Set(["Revenue", "Tax", "Buyback", "Location Total", "Tender Types"]);

function toNum(s: string): number {
  const negative = /^\(.*\)$/.test(s.trim());
  const cleaned = s.replace(/[,$()]/g, "").trim();
  const n = parseFloat(cleaned);
  const value = Number.isNaN(n) ? 0 : n;
  return negative ? -value : value;
}

function isJunkRow(first: string): boolean {
  return (
    first === "Dept / Type" || /^sales by tender/i.test(first) || /^report run date/i.test(first)
  );
}

export interface ParseResult {
  tenderTotals: TenderTotalRow[];
  departmentRows: DepartmentRevenueRow[];
  skippedCount: number;
  skippedExamples: string[];
}

export async function parseTenderSummaryReport(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  const records: string[][] = [];
  grid.forEach((raw) => {
    const cells = raw.map((c) => String(c ?? "").trim());
    const nonEmpty = cells.filter((c) => c !== "");
    if (nonEmpty.length > 0) records.push(nonEmpty);
  });

  const tenderTotals: TenderTotalRow[] = [];
  const departmentRows: DepartmentRevenueRow[] = [];
  const skippedExamples: string[] = [];
  let skippedCount = 0;

  const firstHeaderIdx = records.findIndex((r) => r[0] === "Dept / Type");
  if (firstHeaderIdx <= 0) {
    return { tenderTotals, departmentRows, skippedCount: records.length, skippedExamples };
  }

  // The very first tender name sits immediately before the first header, before
  // any subsection structure has started.
  let currentTender = records[firstHeaderIdx - 1][0];
  let currentSection: string | null = null;

  for (let idx = firstHeaderIdx; idx < records.length; idx++) {
    const nonEmpty = records[idx];
    const first = nonEmpty[0];
    if (isJunkRow(first)) continue;

    if (nonEmpty.length === 1) {
      if (ADMIN_LABELS.has(first)) {
        currentSection = first;
        continue;
      }
      const next = records[idx + 1];
      if (next && next[0] === "Dept / Type") {
        // Only a tender name (new, or the same one repeating after a page break)
        // is ever immediately followed by the column header.
        currentTender = first;
        currentSection = null;
      } else {
        // An extra product subsection, e.g. "Digital Subscriptions" or "Rentals".
        currentSection = "product";
      }
      continue;
    }

    if (nonEmpty.length !== 16) {
      skippedCount++;
      if (skippedExamples.length < 3) {
        skippedExamples.push(
          `Row ${idx + 1}: unrecognized line "${nonEmpty.join(" | ").slice(0, 60)}"`,
        );
      }
      continue;
    }

    if (/total/i.test(first)) continue; // roll-up rows — we derive our own totals instead

    const gross = toNum(nonEmpty[4]);
    const saleQty = toNum(nonEmpty[5]);
    const refund = toNum(nonEmpty[9]);
    const refQty = toNum(nonEmpty[10]);
    const discount = toNum(nonEmpty[14]);
    const net = toNum(nonEmpty[15]);

    if (currentSection === "Tender Types") {
      tenderTotals.push({ tender: currentTender, gross, saleQty, refund, refQty, discount, net });
      continue;
    }

    if (currentSection === "product" && /^\d+\s*-\s*/.test(first)) {
      departmentRows.push({
        tender: currentTender,
        department: first,
        gross,
        saleQty,
        refund,
        refQty,
        discount,
        net,
      });
      continue;
    }

    // Revenue / Tax / Buyback / Location Total data rows — intentionally not needed here.
  }

  return { tenderTotals, departmentRows, skippedCount, skippedExamples };
}
