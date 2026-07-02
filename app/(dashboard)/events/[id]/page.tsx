'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Event } from '@/types';
import { ArrowLeft, ExternalLink, QrCode, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, organizer } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'events', id)).then((snap) => {
      if (snap.exists()) setEvent({ id: snap.id, ...snap.data() } as Event);
      setLoading(false);
    });
  }, [id]);

  async function togglePublish() {
    if (!event) return;
    setPublishing(true);
    const newStatus = event.status === 'published' ? 'draft' : 'published';
    await updateDoc(doc(db, 'events', event.id), { status: newStatus });
    setEvent({ ...event, status: newStatus });
    setPublishing(false);
  }

  async function createValidationSession() {
    const res = await fetch('/api/validation/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: id }),
    });
    const data = await res.json();
    if (data.url) {
      await navigator.clipboard.writeText(data.url);
      alert(`URL de validación copiada al portapapeles:\n${data.url}`);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!event) return <div className="p-8 text-gray-500">Evento no encontrado</div>;

  const totalSold = event.ticketTypes.reduce((a, t) => a + t.sold, 0);
  const totalStock = event.ticketTypes.reduce((a, t) => a + t.stock, 0);
  const eventDate = event.date ? new Date((event.date as unknown as { seconds: number }).seconds * 1000) : null;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/events" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
        <div className="flex-1" />
        <button
          onClick={createValidationSession}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <QrCode className="w-4 h-4" />
          Crear sesión validación
        </button>
        <button
          onClick={togglePublish}
          disabled={publishing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            event.status === 'published'
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {event.status === 'published' ? (
            <><XCircle className="w-4 h-4" /> Despublicar</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Publicar</>
          )}
        </button>
      </div>

      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.title} className="w-full h-56 object-cover rounded-xl mb-6" />
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          {eventDate && (
            <p className="text-gray-500 mt-1">{format(eventDate, "EEEE d 'de' MMMM yyyy · HH:mm", { locale: es })}</p>
          )}
          <p className="text-gray-500">{event.venue} · {event.city}</p>
        </div>
        {organizer?.slug && event.slug && (
          <Link
            href={`/${organizer.slug}/${event.slug}`}
            target="_blank"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Ver página pública <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {event.description && (
        <p className="text-gray-600 mb-6 bg-gray-50 rounded-lg p-4">{event.description}</p>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{totalSold}</p>
          <p className="text-sm text-gray-500 mt-1">Tickets vendidos</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{totalStock - totalSold}</p>
          <p className="text-sm text-gray-500 mt-1">Disponibles</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">
            {totalStock > 0 ? Math.round((totalSold / totalStock) * 100) : 0}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Ocupación</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Tipos de ticket</h2>
        <div className="space-y-3">
          {event.ticketTypes.map((tt) => (
            <div key={tt.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-gray-900">{tt.name}</p>
                <p className="text-sm text-gray-500">
                  ${tt.price.toLocaleString('es-CL')} CLP · {tt.sold}/{tt.stock} vendidos
                </p>
              </div>
              <div className="w-32 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${tt.stock > 0 ? (tt.sold / tt.stock) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
