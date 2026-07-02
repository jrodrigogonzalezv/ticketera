'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Scan } from 'lucide-react';

type ScanResult = {
  valid: boolean;
  reason?: string;
  holderName?: string;
  ticketTypeName?: string;
  scannedAt?: string;
} | null;

function ValidateContent({ eventId }: { eventId: string }) {
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get('session');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult>(null);
  const [error, setError] = useState('');
  const scannerRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => { scannerRef.current?.stop(); };
  }, []);

  async function startScanner() {
    setResult(null);
    setError('');
    setScanning(true);

    const Html5Qrcode = (await import('html5-qrcode')).Html5Qrcode;
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await scanner.stop();
          setScanning(false);
          await processQr(decodedText);
        },
        undefined
      );
    } catch {
      setScanning(false);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  }

  async function processQr(payload: string) {
    try {
      const res = await fetch('/api/validation/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPayload: payload, sessionToken, eventId }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ valid: false, reason: 'Error de conexión. Intenta de nuevo.' });
    }
  }

  if (!sessionToken) {
    return (
      <div className="text-center text-white">
        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold">Sesión inválida</h1>
        <p className="text-gray-400 mt-2">Esta URL no tiene una sesión de validación válida.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <Scan className="w-10 h-10 text-blue-400 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-white">Validador de tickets</h1>
        <p className="text-gray-400 text-sm mt-1">Escanea el código QR del ticket</p>
      </div>

      {!scanning && !result && (
        <button
          onClick={startScanner}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-3"
        >
          <Scan className="w-6 h-6" />
          Escanear QR
        </button>
      )}

      {scanning && (
        <div className="bg-black rounded-2xl overflow-hidden">
          <div id="qr-reader" className="w-full" />
          <button
            onClick={() => { scannerRef.current?.stop(); setScanning(false); }}
            className="w-full py-3 text-gray-400 text-sm hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {result && (
        <div className={`rounded-2xl p-6 text-center ${result.valid ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'}`}>
          {result.valid ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white">VÁLIDO</h2>
              {result.holderName && <p className="text-green-200 mt-2 text-lg font-medium">{result.holderName}</p>}
              {result.ticketTypeName && <p className="text-green-300 text-sm mt-1">{result.ticketTypeName}</p>}
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white">INVÁLIDO</h2>
              <p className="text-red-200 mt-2">{result.reason}</p>
              {result.scannedAt && (
                <p className="text-red-300 text-xs mt-2">
                  Escaneado: {new Date(result.scannedAt).toLocaleString('es-CL')}
                </p>
              )}
            </>
          )}
          <button
            onClick={() => { setResult(null); startScanner(); }}
            className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
          >
            Escanear otro
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-xl text-red-200 text-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
}

export default function ValidatePage() {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <Suspense fallback={
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      }>
        <ValidateContent eventId={eventId} />
      </Suspense>
    </div>
  );
}
