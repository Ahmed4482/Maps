import { memo } from 'react';
import { Shipment } from '@/types/shipment';
import { ShipmentCard } from './ShipmentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ShipmentListProps {
  shipments: Shipment[];
  loading?: boolean;
  error?: string | null;
  onPinToggle?: (id: string, isPinned: boolean) => void;
  selectedShipmentId?: string | null;
  onSelect?: (shipment: Shipment) => void;
}

export const ShipmentList = memo(function ShipmentList({ 
  shipments, 
  loading, 
  error, 
  onPinToggle,
  selectedShipmentId,
  onSelect 
}: ShipmentListProps) {
  const pinned = shipments.filter((s) => s.is_pinned);
  const others = shipments.filter((s) => !s.is_pinned);

  if (loading && shipments.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl border-2 border-[#0A5C3A]/20 bg-white p-6 shadow-sm"
          >
            <Skeleton className="h-6 w-48 bg-gray-200" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full bg-gray-200" />
              <Skeleton className="h-4 w-3/4 bg-gray-200" />
              <Skeleton className="h-4 w-full bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="bg-red-50 border-red-200">
        <AlertDescription className="text-red-800">{error}</AlertDescription>
      </Alert>
    );
  }

  if (shipments.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[#0A5C3A]/20 bg-[#0A5C3A]/5 p-12 text-center">
        <p className="text-gray-600 text-lg">No shipments found</p>
        <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pinned.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-[#0A5C3A]/10 px-4 py-2 border border-[#0A5C3A]/20">
            <span className="h-1.5 w-6 rounded-full bg-[#0A5C3A]" />
            <span className="text-sm font-semibold text-[#0A5C3A]">Pinned Shipments</span>
          </div>
          <div className="space-y-4">
            {pinned.map((shipment) => (
              <ShipmentCard 
                key={shipment.id} 
                shipment={shipment} 
                onPinToggle={onPinToggle}
                onSelect={onSelect}
                isSelected={selectedShipmentId === shipment.id}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {others.map((shipment) => (
          <ShipmentCard 
            key={shipment.id} 
            shipment={shipment} 
            onPinToggle={onPinToggle}
            onSelect={onSelect}
            isSelected={selectedShipmentId === shipment.id}
          />
        ))}
      </div>
    </div>
  );
});
