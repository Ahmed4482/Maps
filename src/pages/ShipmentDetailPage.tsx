import { useParams } from '@tanstack/react-router';

export function ShipmentDetailPage() {
  const { id } = useParams({ from: '/shipments/$id' });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">Shipment Details</h1>
      <p className="text-gray-600 mt-2">Shipment ID: {id}</p>
      <p className="text-gray-600">Detail page coming soon...</p>
    </div>
  );
}
