'use client';

import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, ExternalLink } from 'lucide-react';

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function SettingsPage() {
  const { user, organizer } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (organizer) {
      setName(organizer.name || '');
      setSlug(organizer.slug || '');
      setPhone(organizer.phone || '');
      setLogoPreview(organizer.logoUrl || '');
    }
  }, [organizer]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    let logoUrl = organizer?.logoUrl || '';
    if (logoFile) {
      const storageRef = ref(storage, `logos/${user.uid}/${logoFile.name}`);
      await uploadBytes(storageRef, logoFile);
      logoUrl = await getDownloadURL(storageRef);
    }

    await updateDoc(doc(db, 'organizers', user.uid), {
      name,
      slug: slugify(slug || name),
      phone,
      logoUrl,
      status: 'active',
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  }

  async function connectMercadoPago() {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/mp/connect', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { authUrl } = await res.json();
    window.location.href = authUrl;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Mi perfil</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Información del organizador</h2>

          <div className="flex items-center gap-4">
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400">
                {name.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div>
              <label className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
                Cambiar logo
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG · máx 2MB</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del organizador *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL pública (slug)</label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-3 py-2 bg-gray-50 text-gray-500 text-sm border-r border-gray-300">
                {typeof window !== 'undefined' ? window.location.host : 'tudominio.com'}/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder={slugify(name)}
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de contacto</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+56 9 1234 5678"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Mercado Pago</h2>
          <p className="text-sm text-gray-500 mb-4">Conecta tu cuenta para recibir los pagos de tus tickets</p>

          {organizer?.mpUserId ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Cuenta conectada</p>
                <p className="text-xs text-green-600">ID: {organizer.mpUserId}</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectMercadoPago}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Conectar Mercado Pago
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saved ? <><CheckCircle className="w-4 h-4" /> Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
