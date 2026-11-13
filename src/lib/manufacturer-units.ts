import * as XLSX from "xlsx";

/**
 * Parser for the POS's "Item Sales by Manufacturer" report export.
 *
 * PLACEHOLDER — this report has no sale price/revenue column, only quantity
 * sold and a cost basis (confirmed: cost is 0.00 on gift cards and "damaged
 * item" lines, which didn't sell for $0). So this can only drive units-sold /
 * cost-of-goods reporting, not real sales-dollar reporting. Once the POS can
 * export a revenue-bearing report (e.g. an item-level sales detail or net
 * sales report with a price column), replace this module — and the "Units"
 * report source in reports.tsx — with a proper revenue import.
 *
 * The file itself is a paginated printout, not a flat table: a few preamble
 * rows, then a header row, then data rows grouped under manufacturer-name
 * "section" rows (blank SKU, just the manufacturer name) — and the title +
 * header + a "Report Run Date... Page X of Y" footer repeat every page.
 * Columns are padded with extra blank cells for visual alignment and the
 * padding varies between pages, so real values are read positionally after
 * dropping the blanks, not by fixed column index.
 */

export interface ManufacturerUnitRow {
  id: string;
  manufacturer: string;
  sku: string;
  title?: string;
  catalogNumber?: string;
  quantitySold: number;
  onHand?: number;
  ordersNotReceived?: number;
  cost?: number;
}

export interface UnitsImportMeta {
  filename: string;
  importedAt: string;
  rowCount: number;
  skippedCount: number;
}

interface UnitsStore {
  rows: ManufacturerUnitRow[];
  lastImport: UnitsImportMeta | null;
}

const STORAGE_KEY = "litlx:mfrUnits:v1";

export function loadUnitsStore(): UnitsStore {
  if (typeof window === "undefined") return { rows: [], lastImport: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rows: [], lastImport: null };
    const parsed = JSON.parse(raw);
    return { rows: parsed.rows ?? [], lastImport: parsed.lastImport ?? null };
  } catch {
    return { rows: [], lastImport: null };
  }
}

export function saveUnitsStore(store: UnitsStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // storage unavailable (private mode, quota) — imported data just won't persist across reloads
  }
}

function toNum(s: string): number | null {
  const cleaned = s.replace(/[,$]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

export interface ParseResult {
  rows: ManufacturerUnitRow[];
  skippedCount: number;
  skippedExamples: string[];
}

export async function parseManufacturerUnitsReport(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  const rows: ManufacturerUnitRow[] = [];
  const skippedExamples: string[] = [];
  let skippedCount = 0;
  let headerSeen = false;
  let currentManufacturer = "Unknown manufacturer";

  grid.forEach((raw, i) => {
    const cells = raw.map((c) => String(c ?? "").trim());
    const nonEmpty = cells.filter((c) => c !== "");
    if (nonEmpty.length === 0) return;

    if (!headerSeen) {
      if (cells[0] === "SKU/ISBN") headerSeen = true;
      return; // everything before the first header row is report preamble
    }

    const first = nonEmpty[0];
    if (first === "SKU/ISBN") return; // header row repeats on every page
    if (/^item sales by/i.test(first)) return; // report title repeats on every page
    if (/^report run date/i.test(first)) return; // page-break footer

    // A manufacturer "section" row: blank SKU cell, exactly one value (the name).
    // The POS groups items with no manufacturer tagged under the literal string
    // "null" — relabel that so it reads as data, not a bug, in the UI.
    if (cells[0] === "" && nonEmpty.length === 1) {
      currentManufacturer = first.toLowerCase() === "null" ? "No manufacturer assigned" : first;
      return;
    }

    // A real data row starts with a numeric SKU and has enough trailing numeric columns.
    if (!/^\d{6,}$/.test(first) || nonEmpty.length < 5) {
      skippedCount++;
      if (skippedExamples.length < 3) {
        skippedExamples.push(
          `Row ${i + 1}: unrecognized line "${nonEmpty.join(" | ").slice(0, 60)}"`,
        );
      }
      return;
    }

    const cost = toNum(nonEmpty[nonEmpty.length - 1]);
    const ordersNotReceived = toNum(nonEmpty[nonEmpty.length - 2]);
    const onHand = toNum(nonEmpty[nonEmpty.length - 3]);
    const quantitySold = toNum(nonEmpty[nonEmpty.length - 4]);

    if (quantitySold === null) {
      skippedCount++;
      if (skippedExamples.length < 3) {
        skippedExamples.push(`Row ${i + 1}: unreadable sale quantity for SKU ${first}`);
      }
      return;
    }

    const middle = nonEmpty.slice(1, nonEmpty.length - 4);
    rows.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      manufacturer: currentManufacturer,
      sku: first,
      title: middle[0] || undefined,
      catalogNumber: middle.slice(1).join(" ") || undefined,
      quantitySold,
      onHand: onHand ?? undefined,
      ordersNotReceived: ordersNotReceived ?? undefined,
      cost: cost ?? undefined,
    });
  });

  return { rows, skippedCount, skippedExamples };
}
