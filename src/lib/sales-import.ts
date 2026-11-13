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

function toISODate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value ?? "").trim();
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function normalizeRows(raw: Record<string, unknown>[], mapping: ColumnMapping): SalesRow[] {
  const out: SalesRow[] = [];
  raw.forEach((r, i) => {
    const date = mapping.date ? toISODate(r[mapping.date]) : null;
    const total = mapping.total ? toNumber(r[mapping.total]) : null;
    if (!date || total === null) return;

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
  return out;
}

export interface ImportMeta {
  filename: string;
  importedAt: string;
  rowCount: number;
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
