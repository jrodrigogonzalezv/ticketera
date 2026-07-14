import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export function getAdminDb() { return getFirestore(getAdminApp()); }
export function getAdminStorage() { return getStorage(getAdminApp()); }
export function getAdminAuth() { return getAuth(getAdminApp()); }

// Backwards-compat aliases — resolved at call time, not at import time
export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_, prop: string) { return (getAdminDb() as any)[prop]; },
});
export const adminStorage = new Proxy({} as ReturnType<typeof getStorage>, {
  get(_, prop: string) { return (getAdminStorage() as any)[prop]; },
});
export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_, prop: string) { return (getAdminAuth() as any)[prop]; },
});
