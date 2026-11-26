// Client for the CBS Smart System API (WAY-Equity/cbs-smart-system-backend).
// The API is used only when VITE_API_URL is set at build time; otherwise the
// app stays the localStorage demo.

export const API_URL: string = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') ?? '';
export const apiEnabled = API_URL !== '';

const SESSION_KEY = 'cbs-api-session-v1';

export type Session = {code: string; personId: string; personName: string};

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: the session simply is not remembered */
  }
}

export class ApiError extends Error {
  status: number;
  field: string;
  constructor(status: number, message: string, field = '') {
    super(message);
    this.status = status;
    this.field = field;
  }
}

function headers(s: Session | null, json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (s?.code) h.Authorization = `Bearer ${s.code}`;
  if (s?.personId) h['X-Person-Id'] = s.personId;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function request(s: Session | null, method: string, path: string, body?: unknown): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: headers(s, body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'サーバーに接続できません。インターネット接続を確認して、もう一度お試しください。');
  }
  if (!res.ok) {
    let msg = '読み込みに失敗しました。もう一度お試しください。';
    let field = '';
    try {
      const j = await res.json();
      msg = j.error || msg;
      field = j.field || '';
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, msg, field);
  }
  return res;
}

export async function api<T>(s: Session | null, method: string, path: string, body?: unknown): Promise<T> {
  const res = await request(s, method, path, body);
  return (await res.json()) as T;
}

/** Downloads a CSV from the API (the auth header rules out a plain link). */
export async function downloadCsv(s: Session | null, path: string, fallbackName: string) {
  const res = await request(s, 'GET', path);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

// --- shapes returned by the API (see backend docs/API.md) -------------------

export type Option = {id: string; name: string; group?: string};
export type Lookups = {branches: Option[]; departments: Option[]; people: Option[]; propertyStatuses: Record<string, string>};
export type Change = {before: unknown; after: unknown};
export type HistoryEntry = {at: string; actorName: string; action: string; diff: Record<string, Change>};
export type Page<T> = {items: T[]; total: number};

export type PropertyRow = {
  id: string; propertyCode: string; name: string; nameKana: string; postalCode: string; address: string;
  departmentId: string | null; departmentName: string; branchName: string; status: string; note: string;
  ownerId: string | null; ownerName: string; aliases: string[]; customers: string[];
  confirmedAt: string | null; confirmedByName: string; updatedAt: string; rowVersion: number;
};
export type PropertyDetail = PropertyRow & {
  contractLines: {id: string; serviceName: string; billToId: string; billToName: string; itemCode: string; workMonths: string; unitAmount: number}[];
  documents: {id: string; title: string; docType: string; versionNo: number | null; fileName: string; docDate: string; versions: number; ownerName: string; needsReview: boolean}[];
  history: HistoryEntry[];
};

export type PartyRow = {
  id: string; name: string; nameKana: string; isCustomer: boolean; isVendor: boolean; representative: string;
  postalCode: string; address: string; note: string; billingNote: string; deliveryMethod: string; paymentTerms: string;
  aliases: string[]; propertyCount: number; updatedAt: string; rowVersion: number;
};
export type PartyDetail = PartyRow & {properties: {id: string; propertyCode: string; name: string}[]; history: HistoryEntry[]};
