'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Event } from '@/types';
import { Plus, CalendarDays, MapPin, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
  published: { label: 'Publicado', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-600' },
  finished: { label: 'Finalizado', color: 'bg-blue-100 text-blue-600' },
};

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'events'),
      where('orgId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    getDocs(q).then((snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event)));
      setLoading(false);
    });
  }, [user]);

  const totalSold = events.reduce(
    (acc, e) => acc + e.ticketTypes.reduce((a, t) => a + t.sold, 0),
    0
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis eventos</h1>
          <p className="text-gray-500 mt-1">{events.length} evento{events.length !== 1 ? 's' : ''} · {totalSold} tickets vendidos</p>
        </div>
        <Link
          href="/events/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo evento
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Sin eventos aún</h3>
          <p className="text-gray-500 mt-1 mb-6">Crea tu primer evento para empezar a vender tickets</p>
          <Link
            href="/events/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear evento
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const status = STATUS_LABELS[event.status] || STATUS_LABELS.draft;
            const totalStock = event.ticketTypes.reduce((a, t) => a + t.stock, 0);
            const totalEventSold = event.ticketTypes.reduce((a, t) => a + t.sold, 0);
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4 hover:shadow-md transition-shadow"
              >
                {event.imageUrl ? (
                  <img src={event.imageUrl} alt={event.title} className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-gray-900 truncate">{event.title}</h2>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {event.date ? format(new Date((event.date as unknown as { seconds: number }).seconds * 1000), "d MMM yyyy · HH:mm", { locale: es }) : '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {event.venue}, {event.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5" />
                      {totalEventSold} / {totalStock} vendidos
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
