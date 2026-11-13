import * as XLSX from "xlsx";

export interface SalesRow {
  id: string;
  date: string; // ISO yyyy-mm-dd
  orderId?: string;
  item?: string;
  category?: string;
  manufacturer?: string;
  quantity?: number;
  total: number;
  paymentType?: string;
}

export type FieldKey =
  | "date"
  | "total"
  | "orderId"
  | "item"
  | "category"
  | "manufacturer"
  | "quantity"
  | "paymentType";

export interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  guess: RegExp;
}

export const FIELD_DEFS: FieldDef[] = [
  { key: "date", label: "Date", required: true, guess: /date|time|created|sold/i },
  { key: "total", label: "Total", required: true, guess: /total|amount|revenue|net sale|grand/i },
  {
    key: "orderId",
    label: "Order ID",
    required: false,
    guess: /order|invoice|receipt|transaction|ticket/i,
  },
  { key: "item", label: "Item", required: false, guess: /item|product|description|sku|name/i },
  { key: "category", label: "Category", required: false, guess: /category|department|dept/i },
  {
    key: "manufacturer",
    label: "Manufacturer",
    required: false,
    guess: /manufacturer|mfr|brand|publisher/i,
  },
  { key: "quantity", label: "Quantity", required: false, guess: /qty|quantity|units/i },
  {
    key: "paymentType",
    label: "Payment type",
    required: false,
    guess: /payment|tender|card|cash/i,
  },
];

export type ColumnMapping = Partial<Record<FieldKey, string>>;

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
}

export async function parseSalesFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headerRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  const headers = rows.length
    ? Object.keys(rows[0])
    : ((headerRows[0] as string[] | undefined) ?? []);
  return { headers, rows };
}

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<string>();
  for (const field of FIELD_DEFS) {
    const match = headers.find((h) => !taken.has(h) && field.guess.test(h));
    if (match) {
      mapping[field.key] = match;
      taken.add(match);
    }
  }
  return mapping;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value instanceof Date) return null;
  const str = String(value ?? "").trim();
  if (!str) return null;
  const negative = /^\(.*\)$/.test(str);
  const cleaned = str.replace(/[,$()]/g, "");
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

function isoFromParts(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * CSV cells have no native date type, so POS exports hand us plain strings in
 * whatever format they feel like. `new Date(str)` alone is too unreliable for
 * that (inconsistent across formats/browsers) — so common shapes are parsed
 * explicitly first, falling back to native parsing only for anything else.
 */
function toISODate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value ?? "").trim();
  if (!str) return null;

  // YYYY-MM-DD or YYYY/MM/DD, optionally with a time suffix.
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));

  // M/D/YYYY, M-D-YYYY, or M/D/YY (US convention), optionally with a time suffix.
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return isoFromParts(year, Number(m[1]), Number(m[2]));
  }

  // Fallback: native parsing handles things like "Jan 5, 2026".
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export interface NormalizeResult {
  rows: SalesRow[];
  skippedCount: number;
  skippedExamples: string[];
}

export function normalizeRows(
  raw: Record<string, unknown>[],
  mapping: ColumnMapping,
): NormalizeResult {
  const out: SalesRow[] = [];
  const skippedExamples: string[] = [];
  let skippedCount = 0;

  raw.forEach((r, i) => {
    const rawDate = mapping.date ? r[mapping.date] : undefined;
    const rawTotal = mapping.total ? r[mapping.total] : undefined;
    const date = mapping.date ? toISODate(rawDate) : null;
    const total = mapping.total ? toNumber(rawTotal) : null;

    if (!date || total === null) {
      skippedCount++;
      if (skippedExamples.length < 3) {
        const reason = !date
          ? `unreadable date "${String(rawDate ?? "")}"`
          : `unreadable total "${String(rawTotal ?? "")}"`;
        skippedExamples.push(`Row ${i + 2}: ${reason}`);
      }
      return;
    }

    const str = (key?: string) => {
      if (!key) return undefined;
      const v = String(r[key] ?? "").trim();
      return v || undefined;
    };

    out.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      total,
      orderId: str(mapping.orderId),
      item: str(mapping.item),
      category: str(mapping.category),
      manufacturer: str(mapping.manufacturer),
      quantity: mapping.quantity ? (toNumber(r[mapping.quantity]) ?? undefined) : undefined,
      paymentType: str(mapping.paymentType),
    });
  });

  return { rows: out, skippedCount, skippedExamples };
}

export interface ImportMeta {
  filename: string;
  importedAt: string;
  rowCount: number;
  skippedCount?: number;
}

interface SalesStore {
  rows: SalesRow[];
  lastImport: ImportMeta | null;
}

const STORAGE_KEY = "litlx:sales:v1";

export function loadSalesStore(): SalesStore {
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

export function saveSalesStore(store: SalesStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // storage unavailable (private mode, quota) — imported data just won't persist across reloads
  }
}
