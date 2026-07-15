import { BarChart3 } from 'lucide-react';

export default function SalesPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
        <p className="text-gray-500 mt-1">Resumen de ventas y transacciones de tus eventos.</p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">Próximamente</p>
        <p className="text-gray-400 text-sm mt-1">El reporte de ventas estará disponible pronto.</p>
      </div>
    </div>
  );
}
