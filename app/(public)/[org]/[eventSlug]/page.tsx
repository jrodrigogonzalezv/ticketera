import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Event, Organizer } from '@/types';
import { notFound } from 'next/navigation';
import EventCheckout from './EventCheckout';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, CalendarDays, Ticket } from 'lucide-react';

async function getEventBySlug(orgSlug: string, eventSlug: string) {
  const orgsSnap = await getDocs(query(collection(db, 'organizers'), where('slug', '==', orgSlug)));
  if (orgsSnap.empty) return null;
  const org = { id: orgsSnap.docs[0].id, ...orgsSnap.docs[0].data() } as Organizer;

  const eventsSnap = await getDocs(
    query(collection(db, 'events'), where('orgId', '==', org.id), where('slug', '==', eventSlug))
  );
  if (eventsSnap.empty) return null;
  const event = { id: eventsSnap.docs[0].id, ...eventsSnap.docs[0].data() } as Event;

  return { org, event };
}

export default async function EventPublicPage({
  params,
}: {
  params: { org: string; eventSlug: string };
}) {
  const data = await getEventBySlug(params.org, params.eventSlug);

  if (!data || data.event.status !== 'published') notFound();

  const { org, event } = data;
  const eventDate = event.date ? new Date((event.date as unknown as { seconds: number }).seconds * 1000) : null;
  const availableTypes = event.ticketTypes.filter((t) => t.sold < t.stock);

  return (
    <div className="min-h-screen bg-gray-50">
      {event.imageUrl && (
        <div className="w-full h-72 relative">
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 -mt-16 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <img src={org.logoUrl || '/favicon.ico'} alt={org.name} className="w-6 h-6 rounded-full" />
                <span>{org.name}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>

              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                {eventDate && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-blue-500" />
                    {format(eventDate, "EEEE d 'de' MMMM yyyy · HH:mm", { locale: es })}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  {event.venue}, {event.city}
                </span>
              </div>
            </div>

            {event.description && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3">Sobre el evento</h2>
                <p className="text-gray-600 whitespace-pre-line">{event.description}</p>
              </div>
            )}
          </div>

          <div>
            {availableTypes.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
                <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-700">Entradas agotadas</p>
              </div>
            ) : (
              <EventCheckout event={event} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { org: string; eventSlug: string } }) {
  const data = await getEventBySlug(params.org, params.eventSlug);
  if (!data) return {};
  return {
    title: data.event.title,
    description: data.event.description?.slice(0, 160),
    openGraph: {
      images: data.event.imageUrl ? [data.event.imageUrl] : [],
    },
  };
}
