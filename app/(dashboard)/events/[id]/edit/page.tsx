'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { TicketType, Event } from '@/types';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    dateDay: '',
    dateTime: '',
    endDateDay: '',
    endDateTime: '',
    venue: '',
    address: '',
    city: '',
  });

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'events', id)).then((snap) => {
      if (!snap.exists()) { setFetching(false); return; }
      const e = snap.data() as Event;

      const toDateDay = (ts: unknown) => {
        if (!ts) return '';
        const d = new Date((ts as { seconds: number }).seconds * 1000);
        return d.toISOString().slice(0, 10);
      };
      const toDateTime = (ts: unknown) => {
        if (!ts) return '';
        const d = new Date((ts as { seconds: number }).seconds * 1000);
        return d.toTimeString().slice(0, 5);
      };

      setForm({
        title: e.title || '',
        description: e.description || '',
        dateDay: toDateDay(e.date),
        dateTime: toDateTime(e.date),
        endDateDay: toDateDay(e.endDate),
        endDateTime: toDateTime(e.endDate),
        venue: e.venue || '',
        address: (e as Event & { address?: string }).address || '',
        city: e.city || '',
      });
      setTicketTypes(e.ticketTypes || []);
      setImagePreview((e as Event & { imageUrl?: string }).imageUrl || '');
      setFetching(false);
    });
  }, [id]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function addTicketType() {
    setTicketTypes((prev) => [...prev, { id: generateId(), name: '', price: 0, stock: 50, sold: 0 }]);
  }

  function removeTicketType(id: string) {
    setTicketTypes((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTicketType(id: string, field: keyof TicketType, value: string | number) {
    setTicketTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !id) return;
    setError('');

    if (!form.dateDay || !form.dateTime) {
      setError('Debes seleccionar fecha y hora de inicio.');
      return;
    }

    if (form.endDateDay && form.endDateTime) {
      const start = new Date(`${form.dateDay}T${form.dateTime}`);
      const end = new Date(`${form.endDateDay}T${form.endDateTime}`);
      if (end <= start) {
        setError('La fecha de término debe ser posterior a la fecha de inicio.');
        return;
      }
    }

    setLoading(true);
    try {
      let imageUrl = imagePreview;
      if (imageFile) {
        const storageRef = ref(storage, `events/${user.uid}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      const dateStr = `${form.dateDay}T${form.dateTime}`;
      const endDateStr = form.endDateDay && form.endDateTime ? `${form.endDateDay}T${form.endDateTime}` : null;

      await updateDoc(doc(db, 'events', id), {
        title: form.title,
        description: form.description,
        imageUrl,
        date: Timestamp.fromDate(new Date(dateStr)),
        endDate: endDateStr ? Timestamp.fromDate(new Date(endDateStr)) : null,
        venue: form.venue,
        address: form.address,
        city: form.city,
        ticketTypes,
      });

      router.push(`/events/${id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error al guardar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href={`/events/${id}`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" />
          Volver al evento
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Información del evento</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora inicio *</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                required
                value={form.dateDay}
                onChange={(e) => setForm({ ...form, dateDay: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
              <input
                type="time"
                required
                value={form.dateTime}
                onChange={(e) => setForm({ ...form, dateTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y hora fin <span className="text-gray-400 font-normal">(opcional)</span></label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={form.endDateDay}
                min={form.dateDay || undefined}
                disabled={!form.dateDay}
                onChange={(e) => setForm({ ...form, endDateDay: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              />
              <input
                type="time"
                value={form.endDateTime}
                disabled={!form.dateDay || !form.endDateDay}
                onChange={(e) => setForm({ ...form, endDateTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recinto / lugar *</label>
              <input
                type="text"
                required
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad *</label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="Ej: Loreto 29, Providencia"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del evento</label>
            {imagePreview && (
              <img src={imagePreview} alt="preview" className="w-full h-48 object-cover rounded-lg mb-2" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Tipos de ticket</h2>
            <button
              type="button"
              onClick={addTicketType}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Agregar tipo
            </button>
          </div>

          {ticketTypes.map((ticket, i) => (
            <div key={ticket.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Tipo {i + 1}</span>
                {ticketTypes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTicketType(ticket.id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={ticket.name}
                    onChange={(e) => updateTicketType(ticket.id, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Precio (CLP)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={ticket.price}
                    onChange={(e) => updateTicketType(ticket.id, 'price', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stock</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={ticket.stock}
                    onChange={(e) => updateTicketType(ticket.id, 'stock', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Link href={`/events/${id}`} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-center font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
