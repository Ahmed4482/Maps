import { memo, useEffect, useMemo, useState } from 'react';
import { MapPin, Package, Pin, PinOff, Clock4, ChevronDown, ChevronUp, Ship, Plane, Truck, Box } from 'lucide-react';
import { Shipment } from '@/types/shipment';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getModeIcon, getStatusColor, getStatusLabel, formatDate } from '@/utils/helpers';
import { updateShipmentPin } from '@/services/api';
import { cn } from '@/lib/utils';

interface ShipmentCardProps {
  shipment: Shipment;
  onPinToggle?: (id: string, isPinned: boolean) => void;
  onSelect?: (shipment: Shipment) => void;
  isSelected?: boolean;
}

export const ShipmentCard = memo(function ShipmentCard({ 
  shipment, 
  onPinToggle,
  onSelect,
  isSelected = false 
}: ShipmentCardProps) {
  const [isPinned, setIsPinned] = useState(shipment.is_pinned);
  const [pinLoading, setPinLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsPinned(shipment.is_pinned);
  }, [shipment.is_pinned]);

  // Get all 4 route stops from milestones - ALWAYS show all 4 milestones
  // Milestones are already transformed with correct locations (origin/origin/dest/dest)
  const routeStops = useMemo(() => {
    // Filter to get only the 4 core milestones (0, 1, 2, 3) and sort by type
    const coreMilestones = shipment.milestones
      .filter((m) => {
        const name = m.name.toLowerCase();
        return name.includes('empty') || 
               name.includes('departure') || 
               name.includes('arrival') || 
               name.includes('delivery');
      })
      .sort((a, b) => {
        // Sort by milestone type order: Empty (0), Departure (1), Arrival (2), Delivery (3)
        const getOrder = (name: string) => {
          const n = name.toLowerCase();
          if (n.includes('empty')) return 0;
          if (n.includes('departure')) return 1;
          if (n.includes('arrival')) return 2;
          if (n.includes('delivery')) return 3;
          return 99;
        };
        return getOrder(a.name) - getOrder(b.name);
      });

    // Map milestones to route stops - use milestone data directly
    const stops = coreMilestones.map((milestone) => ({
      location: milestone.location,
      date: milestone.date,
      status: milestone.status,
      milestoneName: milestone.name,
    }));

    // Ensure we have exactly 4 stops (create placeholders if missing)
    while (stops.length < 4) {
      const milestoneNames = [
        'Empty to shipper',
        'Departure from first POL',
        'Arrival at final POD',
        'Delivery to consignee'
      ];
      const missingIndex = stops.length;
      stops.push({
        location: missingIndex < 2 ? shipment.origin : shipment.destination,
        date: null,
        status: 'upcoming' as const,
        milestoneName: milestoneNames[missingIndex] || 'Unknown',
      });
    }

    return stops.slice(0, 4); // Ensure exactly 4 stops
  }, [shipment]);

  // Calculate progress - line should go only up to current milestone
  const completedStops = routeStops.filter((s) => s.status === 'completed').length;
  const currentStopIndex = routeStops.findIndex((s) => s.status === 'current');
  
  // Progress should be up to current milestone (or last completed if no current)
  const lastReachedIndex = currentStopIndex >= 0 ? currentStopIndex : completedStops - 1;
  const progress = routeStops.length > 0 && lastReachedIndex >= 0 
    ? ((lastReachedIndex + 1) / routeStops.length) * 100 
    : 0;
  const statusColor = getStatusColor(shipment.status);

  const handlePinClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      setPinLoading(true);
      const nextPinned = !isPinned;
      const success = await updateShipmentPin(shipment.id, nextPinned);
      if (success) {
        setIsPinned(nextPinned);
        onPinToggle?.(shipment.id, nextPinned);
      }
    } catch (err) {
      console.error('Failed to update pin', err);
    } finally {
      setPinLoading(false);
    }
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
    onSelect?.(shipment);
  };

  const getModeIconComponent = () => {
    switch (shipment.mode) {
      case 'FCL':
      case 'LCL':
        return <Ship className="h-4 w-4" />;
      case 'Air':
        return <Plane className="h-4 w-4" />;
      case 'Road':
        return <Truck className="h-4 w-4" />;
      default:
        return <Box className="h-4 w-4" />;
    }
  };

  return (
    <Card
      className={cn(
        "group relative flex flex-col gap-0 rounded-xl border-2 transition-all duration-300",
        "bg-white hover:shadow-lg hover:-translate-y-0.5",
        isSelected 
          ? "border-[#0A5C3A] shadow-md shadow-[#0A5C3A]/20" 
          : "border-[#0A5C3A]/20 hover:border-[#0A5C3A]/40",
        isExpanded && "border-[#0A5C3A]"
      )}
    >
      {/* Header Section - Always Visible */}
      <div 
        className="flex items-start justify-between p-5 cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex-1 space-y-3">
          {/* Top Row - Order Number and Status */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-[#0A5C3A] text-white font-bold text-sm px-3 py-1 border-0">
              {shipment.orderNumber}
            </Badge>
            <Badge
              className={cn(
                'border font-semibold capitalize px-3 py-1',
                statusColor?.bg,
                statusColor?.text,
                statusColor?.border,
              )}
            >
              {getStatusLabel(shipment.status)}
            </Badge>
            <Badge className="bg-[#0A5C3A]/10 text-[#0A5C3A] border-[#0A5C3A]/20 px-3 py-1 flex items-center gap-1.5">
              {getModeIconComponent()}
              <span>{shipment.mode}</span>
            </Badge>
          </div>

          {/* Route Info */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="h-4 w-4 text-[#0A5C3A]" />
              <span className="font-medium">{shipment.origin.split(',')[0]}</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-[#0A5C3A]/30 via-[#0A5C3A]/20 to-transparent" />
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="h-4 w-4 text-[#0A5C3A]" />
              <span className="font-medium">{shipment.destination.split(',')[0]}</span>
            </div>
          </div>

          {/* Additional Details - Visible before expansion */}
          <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap pt-1">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-700">BL:</span>
              <span>{shipment.blNumber}</span>
            </div>
            {shipment.customerRefNumber && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-700">Ref:</span>
                <span>{shipment.customerRefNumber}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock4 className="h-3.5 w-3.5 text-[#0A5C3A]" />
              <span>{formatDate(shipment.createdDate, 'MMM dd, yyyy')}</span>
            </div>
            {shipment.estimatedDelivery && (
              <div className="flex items-center gap-1.5">
                <Clock4 className="h-3.5 w-3.5 text-[#0A5C3A]" />
                <span>Est: {formatDate(shipment.estimatedDelivery, 'MMM dd, yyyy')}</span>
              </div>
            )}
            {shipment.containers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-[#0A5C3A]" />
                <span>{shipment.containers.length} container{shipment.containers.length > 1 ? 's' : ''}</span>
              </div>
            )}
            {shipment.packages.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Box className="h-3.5 w-3.5 text-[#0A5C3A]" />
                <span>{shipment.packages.reduce((sum, p) => sum + p.quantity, 0)} pkg{shipment.packages.reduce((sum, p) => sum + p.quantity, 0) > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label={isPinned ? 'Unpin shipment' : 'Pin shipment'}
            className={cn(
              'h-9 w-9 rounded-lg border-2 transition-all',
              isPinned 
                ? 'text-[#0A5C3A] bg-[#0A5C3A]/10 border-[#0A5C3A] hover:bg-[#0A5C3A]/20' 
                : 'text-gray-400 border-[#0A5C3A]/20 hover:text-[#0A5C3A] hover:border-[#0A5C3A]/40 hover:bg-[#0A5C3A]/5'
            )}
            onClick={handlePinClick}
            disabled={pinLoading}
          >
            {isPinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-lg border-2 border-[#0A5C3A]/20 text-gray-400 transition-all",
              "hover:text-[#0A5C3A] hover:border-[#0A5C3A]/40 hover:bg-[#0A5C3A]/5",
              isExpanded && "text-[#0A5C3A] border-[#0A5C3A]/40 bg-[#0A5C3A]/10"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Route Visualization Section - Always Visible */}
      <div className="px-5 pb-4">
        <div className="rounded-lg border-2 border-[#0A5C3A]/10 bg-[#0A5C3A]/5 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0A5C3A]">
              <Clock4 className="h-3.5 w-3.5" />
              Route Progress
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 border border-[#0A5C3A]/20">
              <Clock4 className="h-3 w-3 text-[#0A5C3A]" />
              {completedStops}/{routeStops.length} stops
            </div>
          </div>

          {/* Horizontal Route Timeline */}
          <div className="relative mb-4">
            <div className="relative flex items-start justify-between">
              {/* Background connecting line (dashed for upcoming) */}
              <div className="absolute top-4 left-0 right-0 h-0.5">
                <div className="h-full border-t border-dashed border-[#0A5C3A]/30" />
              </div>
              
              {/* Completed connecting line (solid) - goes up to current milestone */}
              {lastReachedIndex >= 0 && (
                <div 
                  className="absolute top-4 left-0 h-1 bg-[#0A5C3A] transition-all duration-500 rounded-full"
                  style={{ 
                    width: routeStops.length > 1 
                      ? `${(lastReachedIndex / Math.max(routeStops.length - 1, 1)) * 100}%`
                      : '0%',
                  }}
                />
              )}
              
              {/* Upcoming connecting line (dashed) - from current to end */}
              {lastReachedIndex >= 0 && lastReachedIndex < routeStops.length - 1 && (
                <div 
                  className="absolute top-4 left-0 h-0.5 border-t border-dashed border-[#0A5C3A]/40 transition-all duration-500"
                  style={{ 
                    left: routeStops.length > 1 
                      ? `${(lastReachedIndex / Math.max(routeStops.length - 1, 1)) * 100}%`
                      : '0%',
                    width: routeStops.length > 1 
                      ? `${((routeStops.length - 1 - lastReachedIndex) / Math.max(routeStops.length - 1, 1)) * 100}%`
                      : '0%',
                  }}
                />
              )}

              {routeStops.map((stop, index) => {
                const isCompleted = stop.status === 'completed';
                const isCurrent = stop.status === 'current';

                return (
                  <div key={index} className="relative z-10 flex flex-1 flex-col items-center">
                    {/* Stop Marker */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={cn(
                          'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all shadow-sm',
                          isCompleted
                            ? 'border-[#0A5C3A] bg-[#0A5C3A] text-white'
                            : isCurrent
                            ? 'border-[#0A5C3A] bg-white text-[#0A5C3A] shadow-md animate-pulse'
                            : 'border-[#0A5C3A]/30 bg-white text-gray-400'
                        )}
                      >
                        {isCompleted ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-white" />
                        ) : isCurrent ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-[#0A5C3A] animate-pulse" />
                        ) : (
                          <div className="h-2.5 w-2.5 rounded-full bg-[#0A5C3A]/30" />
                        )}
                      </div>
                      {isCurrent && (
                        <div className="absolute inset-0 h-9 w-9 animate-ping rounded-full border-2 border-[#0A5C3A] opacity-20" />
                      )}
                    </div>

                    {/* Milestone Name (not location) */}
                    <div className="mt-2 flex flex-col items-center gap-0.5">
                      <p className="text-[9px] font-semibold text-[#0A5C3A] text-center leading-tight max-w-[100px]">
                        {stop.milestoneName.split(' ').slice(0, 2).join(' ')}
                      </p>
                      <p className="text-[10px] font-medium text-gray-700 text-center leading-tight max-w-[90px] truncate">
                        {stop.location.split(',')[0]}
                      </p>
                      {stop.date ? (
                        <p className="text-[9px] text-gray-500 text-center">
                          {formatDate(stop.date, 'MM/dd')}
                        </p>
                      ) : (
                        <p className="text-[9px] text-gray-400 text-center italic">
                          Pending
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Bar - shows progress up to current milestone */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#0A5C3A]/10 border border-[#0A5C3A]/20">
            <div
              className="h-full rounded-full bg-[#0A5C3A] transition-all duration-500 shadow-sm"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="border-t-2 border-[#0A5C3A]/10 bg-[#0A5C3A]/5 p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Consignee</p>
              <p className="text-sm font-semibold text-gray-900">{shipment.consignee}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Shipper</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{shipment.shipper}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-600">BL Number</p>
              <p className="text-sm font-semibold text-gray-900">{shipment.blNumber}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Customer Ref</p>
              <p className="text-sm font-semibold text-gray-900">{shipment.customerRefNumber || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Created</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(shipment.createdDate)}</p>
            </div>
            {shipment.estimatedDelivery && (
              <div className="space-y-1">
                <p className="text-xs text-gray-600">Est. Delivery</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(shipment.estimatedDelivery)}</p>
              </div>
            )}
          </div>

          {/* Packages/Containers Info */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#0A5C3A]/10">
            {shipment.containers.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border-2 border-[#0A5C3A]/20">
                <Package className="h-4 w-4 text-[#0A5C3A]" />
                <span className="text-xs font-medium text-gray-700">
                  {shipment.containers.length} container{shipment.containers.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
            {shipment.packages.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 border-2 border-[#0A5C3A]/20">
                <Box className="h-4 w-4 text-[#0A5C3A]" />
                <span className="text-xs font-medium text-gray-700">
                  {shipment.packages.length} package{shipment.packages.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
});
