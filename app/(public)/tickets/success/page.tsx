'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Ticket } from '@/types';
import { CheckCircle, Download } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    const q = query(collection(db, 'tickets'), where('orderId', '==', orderId));
    const unsub = onSnapshot(q, (snap) => {
      const ts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket));
      setTickets(ts);
      if (ts.length > 0) setLoading(false);
    });
    const t = setTimeout(() => setLoading(false), 10000);
    return () => { unsub(); clearTimeout(t); };
  }, [orderId]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8 text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-gray-900">¡Pago confirmado!</h1>
      <p className="text-gray-500 mt-2">
        Recibirás tus tickets en tu correo. También los puedes descargar aquí.
      </p>

      {loading ? (
        <div className="mt-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Generando tus tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">Tus tickets serán enviados a tu correo en unos minutos.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {tickets.map((ticket, i) => (
            <div key={ticket.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="text-left">
                <p className="font-medium text-gray-900">Ticket #{i + 1}</p>
                <p className="text-sm text-gray-500">{ticket.ticketTypeName} · {ticket.holderName}</p>
              </div>
              {ticket.qrCodeUrl && (
                <a
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Download className="w-4 h-4" />
                  Ver ticket
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
