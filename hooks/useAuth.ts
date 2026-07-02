'use client';

import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import type { Organizer } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'organizers', u.uid));
        if (snap.exists()) {
          setOrganizer({ id: snap.id, ...snap.data() } as Organizer);
        } else {
          // first time Google login — create organizer doc
          await setDoc(doc(db, 'organizers', u.uid), {
            name: u.displayName || '',
            email: u.email || '',
            slug: '',
            serviceFeePercent: 10,
            status: 'pending',
            createdAt: serverTimestamp(),
          });
          const newSnap = await getDoc(doc(db, 'organizers', u.uid));
          setOrganizer({ id: newSnap.id, ...newSnap.data() } as Organizer);
        }
      } else {
        setOrganizer(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loginWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function registerWithEmail(email: string, password: string, name: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'organizers', cred.user.uid), {
      name,
      email,
      slug: '',
      serviceFeePercent: 10,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return cred;
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    // popup works fine in localhost; redirect has COOP issues in some browsers
    const cred = await signInWithPopup(auth, provider);
    return cred;
  }

  async function logout() {
    await signOut(auth);
  }

  return { user, organizer, loading, loginWithEmail, registerWithEmail, loginWithGoogle, logout };
}
