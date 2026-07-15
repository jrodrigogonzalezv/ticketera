import { getAccessToken } from './gcp-token';

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID!;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function toValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, toValue(val)])
        ),
      },
    };
  }
  return { stringValue: String(v) };
}

function fromValue(v: FirestoreValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) {
    return Object.fromEntries(
      Object.entries(v.mapValue.fields || {}).map(([k, val]) => [k, fromValue(val)])
    );
  }
  return null;
}

function docToData(doc: { fields?: Record<string, FirestoreValue>; name?: string }): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    result[k] = fromValue(v);
  }
  return result;
}

function toFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)]));
}

async function headers() {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getDoc(path: string): Promise<{ exists: boolean; data: Record<string, unknown>; id: string } | null> {
  const res = await fetch(`${BASE}/${path}`, { headers: await headers() });
  if (res.status === 404) return { exists: false, data: {}, id: path.split('/').pop()! };
  if (!res.ok) throw new Error(`Firestore getDoc error: ${res.status}`);
  const doc = await res.json();
  return { exists: true, data: docToData(doc), id: path.split('/').pop()! };
}

export async function setDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: await headers(),
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore setDoc error: ${res.status} ${await res.text()}`);
}

export async function updateDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const fieldPaths = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const res = await fetch(`${BASE}/${path}?${fieldPaths}`, {
    method: 'PATCH',
    headers: await headers(),
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore updateDoc error: ${res.status} ${await res.text()}`);
}

export async function addDoc(collection: string, data: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${BASE}/${collection}`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore addDoc error: ${res.status} ${await res.text()}`);
  const doc = await res.json();
  return doc.name.split('/').pop()!;
}

export async function queryDocs(
  collection: string,
  filters: Array<{ field: string; op: string; value: unknown }>
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collection.split('/').pop()! }],
    where: filters.length === 1
      ? {
          fieldFilter: {
            field: { fieldPath: filters[0].field },
            op: filters[0].op,
            value: toValue(filters[0].value),
          },
        }
      : {
          compositeFilter: {
            op: 'AND',
            filters: filters.map((f) => ({
              fieldFilter: {
                field: { fieldPath: f.field },
                op: f.op,
                value: toValue(f.value),
              },
            })),
          },
        },
  };

  // Parent path for subcollections
  const parts = collection.split('/');
  const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  const url = parentPath ? `${BASE}/${parentPath}:runQuery` : `${BASE}:runQuery`;

  const res = await fetch(url, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`Firestore query error: ${res.status} ${await res.text()}`);
  const results = await res.json();
  return results
    .filter((r: { document?: unknown }) => r.document)
    .map((r: { document: { name: string; fields?: Record<string, FirestoreValue> } }) => ({
      id: r.document.name.split('/').pop()!,
      data: docToData(r.document),
    }));
}

export const serverTimestamp = () => new Date();
