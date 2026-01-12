import { useState, useEffect, useMemo } from 'react';
import { List, Map as MapIcon, Plus, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShipmentList } from '@/components/shipments/ShipmentList';
import { MapView } from '@/components/shipments/MapView';
import { MapboxView } from '@/components/shipments/MapboxView';
import { ShipmentFilters } from '@/components/shipments/ShipmentFilters';
import { ShipmentSearch } from '@/components/shipments/ShipmentSearch';
import { Shipment, ShipmentFilters as ShipmentFiltersType } from '@/types/shipment';
import { fetchShipments, updateShipmentPin } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'map';
type MapProvider = 'google' | 'mapbox';

export function ShipmentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [mapProvider, setMapProvider] = useState<MapProvider>('google');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ShipmentFiltersType>({});

  const { origins, destinations } = useMemo(() => {
    const originSet = new Set<string>();
    const destSet = new Set<string>();

    shipments.forEach((s) => {
      if (s.origin) originSet.add(s.origin);
      if (s.destination) destSet.add(s.destination);
    });

    const originsArray = Array.from(originSet).sort();
    const destinationsArray = Array.from(destSet).sort();

    return {
      origins: originsArray,
      destinations: destinationsArray,
    };
  }, [shipments]);

  useEffect(() => {
    let canceled = false;

    async function loadShipments() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchShipments(1, 10000, filters);

        if (!canceled) {
          setShipments(response.data);
        }
      } catch (err) {
        if (!canceled) {
          setError(err instanceof Error ? err.message : 'Failed to load shipments');
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }

    loadShipments();

    return () => {
      canceled = true;
    };
  }, [filters]);

  const handlePinToggle = async (id: string, isPinned: boolean) => {
    const success = await updateShipmentPin(id, isPinned);
    if (success) {
      setShipments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_pinned: isPinned } : s))
      );
    }
  };

  const handleFilterChange = (newFilters: Partial<ShipmentFiltersType>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleSearchChange = (search: string) => {
    handleFilterChange({ search: search || undefined });
  };

  const handleShipmentSelect = (shipment: Shipment) => {
    setSelectedShipmentId(shipment.id);
  };

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 lg:px-8 bg-white">
      <div className="mb-6 -mx-4 -mt-6 px-4 py-8 lg:-mx-8 lg:px-8 rounded-b-2xl bg-[#0A5C3A] flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">
            Shipment Tracking
          </h1>
          <p className="mt-2 text-sm text-white/80">
            Track and manage your freight shipments in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-[#0A5C3A] text-[#0A5C3A] hover:bg-[#0A5C3A]/10 bg-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Shipping
          </Button>
        </div>
      </div>

      <div className="mb-4 relative z-20">
        <ShipmentSearch
          value={filters.search || ''}
          onChange={handleSearchChange}
          placeholder="Search by ID, status, departure, arrival, consignee, shipper..."
        />
      </div>

      <div className="mb-6 relative z-20">
        <ShipmentFilters
          filters={filters}
          updateFilters={handleFilterChange}
          resetFilters={handleResetFilters}
          origins={origins}
          destinations={destinations}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-lg border-2 border-[#0A5C3A]/20 bg-white p-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 transition-all',
                viewMode === 'list'
                  ? 'bg-[#0A5C3A] text-white hover:bg-[#0A5C3A]/90 shadow-sm'
                  : 'text-gray-600 hover:text-[#0A5C3A] hover:bg-[#0A5C3A]/5'
              )}
              onClick={() => {
                setViewMode('list');
                setSelectedShipmentId(null);
              }}
            >
              <List className="h-4 w-4" />
              List View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 transition-all',
                viewMode === 'map'
                  ? 'bg-[#0A5C3A] text-white hover:bg-[#0A5C3A]/90 shadow-sm'
                  : 'text-gray-600 hover:text-[#0A5C3A] hover:bg-[#0A5C3A]/5'
              )}
              onClick={() => {
                setViewMode('map');
                if (!selectedShipmentId && shipments.length > 0) {
                  setSelectedShipmentId(shipments[0].id);
                }
              }}
            >
              <MapIcon className="h-4 w-4" />
              Map View
            </Button>
          </div>
          {viewMode === 'list' && (
            <div className="text-sm text-gray-600">
              {shipments.length} shipment{shipments.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {loading && shipments.length === 0 ? (
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
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <>
            <ShipmentList
              shipments={shipments}
              loading={loading}
              error={error}
              onPinToggle={handlePinToggle}
              selectedShipmentId={selectedShipmentId}
              onSelect={handleShipmentSelect}
            />
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg border-2 border-[#0A5C3A]/20 bg-white p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 transition-all h-auto',
                    mapProvider === 'google'
                      ? 'bg-[#0A5C3A] text-white hover:bg-[#0A5C3A]/90 shadow-sm'
                      : 'text-gray-600 hover:text-[#0A5C3A] hover:bg-[#0A5C3A]/5'
                  )}
                  onClick={() => setMapProvider('google')}
                  title="Switch to Google Maps"
                >
                  <MapIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">Google Maps</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 transition-all h-auto',
                    mapProvider === 'mapbox'
                      ? 'bg-[#0A5C3A] text-white hover:bg-[#0A5C3A]/90 shadow-sm'
                      : 'text-gray-600 hover:text-[#0A5C3A] hover:bg-[#0A5C3A]/5'
                  )}
                  onClick={() => setMapProvider('mapbox')}
                  title="Switch to Mapbox"
                >
                  <Globe className="h-4 w-4" />
                  <span className="text-xs font-medium">Mapbox</span>
                </Button>
              </div>
            </div>

            {mapProvider === 'google' ? (
              <MapView
                shipments={shipments}
                selectedShipmentId={selectedShipmentId}
                onSelect={handleShipmentSelect}
              />
            ) : (
              <MapboxView
                shipments={shipments}
                selectedShipmentId={selectedShipmentId}
                onSelect={handleShipmentSelect}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
