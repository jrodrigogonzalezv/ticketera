'use client';

import { useState } from 'react';
import type { Event } from '@/types';
import { Plus, Minus, Ticket } from 'lucide-react';

type CartItem = { ticketTypeId: string; qty: number };

const SERVICE_FEE_PERCENT = 10;

export default function EventCheckout({ event }: { event: Event }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'cart' | 'form'>('cart');

  function getQty(id: string) {
    return cart.find((c) => c.ticketTypeId === id)?.qty || 0;
  }

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const existing = prev.find((c) => c.ticketTypeId === id);
      if (qty === 0) return prev.filter((c) => c.ticketTypeId !== id);
      if (existing) return prev.map((c) => (c.ticketTypeId === id ? { ...c, qty } : c));
      return [...prev, { ticketTypeId: id, qty }];
    });
  }

  const subtotal = cart.reduce((acc, item) => {
    const tt = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
    return acc + (tt?.price || 0) * item.qty;
  }, 0);

  const serviceFee = Math.round(subtotal * (SERVICE_FEE_PERCENT / 100));
  const total = subtotal + serviceFee;
  const totalTickets = cart.reduce((a, c) => a + c.qty, 0);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          items: cart,
          buyerName,
          buyerEmail,
          buyerPhone,
        }),
      });
      const data = await res.json();
      if (data.initPoint) {
        window.location.href = data.sandboxInitPoint || data.initPoint;
      } else {
        alert(data.error || 'Error al iniciar el pago');
      }
    } catch {
      alert('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm sticky top-4 space-y-4">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Ticket className="w-5 h-5 text-blue-600" />
        Selecciona tus tickets
      </h2>

      {step === 'cart' && (
        <>
          <div className="space-y-3">
            {event.ticketTypes.map((tt) => {
              const qty = getQty(tt.id);
              const available = tt.stock - tt.sold;
              return (
                <div key={tt.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{tt.name}</p>
                      <p className="text-blue-600 font-semibold">
                        {tt.price === 0 ? 'Gratis' : `$${tt.price.toLocaleString('es-CL')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(tt.id, Math.max(0, qty - 1))}
                        disabled={qty === 0}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-medium text-sm">{qty}</span>
                      <button
                        onClick={() => setQty(tt.id, Math.min(available, qty + 1))}
                        disabled={qty >= available || qty >= 10}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{available} disponibles</p>
                </div>
              );
            })}
          </div>

          {totalTickets > 0 && (
            <>
              <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({totalTickets} ticket{totalTickets > 1 ? 's' : ''})</span>
                  <span>${subtotal.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Cargo por servicio ({SERVICE_FEE_PERCENT}%)</span>
                  <span>${serviceFee.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
                  <span>Total</span>
                  <span>${total.toLocaleString('es-CL')}</span>
                </div>
              </div>

              <button
                onClick={() => setStep('form')}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Continuar
              </button>
            </>
          )}
        </>
      )}

      {step === 'form' && (
        <form onSubmit={handleCheckout} className="space-y-3">
          <button type="button" onClick={() => setStep('cart')} className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver
          </button>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
            <input
              type="text"
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
            <input
              type="email"
              required
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="para recibir tus tickets"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input
              type="tel"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between font-bold text-gray-900">
              <span>Total a pagar</span>
              <span>${total.toLocaleString('es-CL')} CLP</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Procesando...' : 'Pagar con Mercado Pago'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Pago seguro procesado por Mercado Pago
          </p>
        </form>
      )}
    </div>
  );
}
