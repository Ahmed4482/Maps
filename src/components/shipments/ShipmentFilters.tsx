import { useMemo, useState, memo } from 'react';
import type { DateRange } from 'react-day-picker';
import { ChevronDown, Filter, RotateCcw } from 'lucide-react';
import type { ShipmentFilters as ShipmentFiltersType, ShipmentMode, ShipmentStatus } from '@/types/shipment';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { formatDate } from '@/utils/helpers';
import { cn } from '@/lib/utils';

interface ShipmentFiltersProps {
  filters: ShipmentFiltersType;
  updateFilters: (filters: Partial<ShipmentFiltersType>) => void;
  resetFilters: () => void;
  origins?: Array<string>;
  destinations?: Array<string>;
}

const statusOptions: Array<{ label: string; value: ShipmentStatus | 'all' }> = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Pending', value: 'pending' },
  { label: 'Closed', value: 'closed' },
];

const modeOptions: Array<{ label: string; value: ShipmentMode | 'all' }> = [
  { label: 'All Modes', value: 'all' },
  { label: 'FCL', value: 'FCL' },
  { label: 'LCL', value: 'LCL' },
  { label: 'Air', value: 'Air' },
  { label: 'Road', value: 'Road' },
];

export const ShipmentFilters = memo(function ShipmentFilters({
  filters,
  updateFilters,
  resetFilters,
  origins = [],
  destinations = [],
}: ShipmentFiltersProps) {
  const [openMobile, setOpenMobile] = useState(false);
  const statusValue = filters.status?.[0] ?? 'all';
  const modeValue = filters.mode?.[0] ?? 'all';
  
  const dateRange: DateRange | undefined = useMemo(() => {
    return filters.dateRange
      ? { from: filters.dateRange.from, to: filters.dateRange.to }
      : undefined;
  }, [filters.dateRange]);

  const uniqueOrigins = useMemo(
    () => Array.from(new Set(origins)).filter(Boolean).sort(),
    [origins]
  );
  const uniqueDestinations = useMemo(
    () => Array.from(new Set(destinations)).filter(Boolean).sort(),
    [destinations]
  );

  const renderControls = useMemo(() => (
    <div className="flex flex-col gap-3 md:grid md:grid-cols-5 md:items-center md:gap-4">
      <Select
        value={statusValue}
        onValueChange={(value: string) => {
          updateFilters({ status: value === 'all' ? [] : [value as ShipmentStatus] });
        }}
      >
        <SelectTrigger className="h-11 rounded-lg border-2 border-[#0A5C3A]/20 bg-white text-gray-900 hover:bg-gray-50">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={modeValue}
        onValueChange={(value: string) => {
          updateFilters({ mode: value === 'all' ? [] : [value as ShipmentMode] });
        }}
      >
        <SelectTrigger className="h-11 rounded-lg border-2 border-[#0A5C3A]/20 bg-white text-gray-900 hover:bg-gray-50">
          <SelectValue placeholder="Mode" />
        </SelectTrigger>
        <SelectContent>
          {modeOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.origin ?? 'all'}
        onValueChange={(value: string) => {
          if (value === 'all') {
            updateFilters({ origin: undefined });
          } else {
            updateFilters({ origin: value });
          }
        }}
      >
        <SelectTrigger className="h-11 rounded-lg border-2 border-[#0A5C3A]/20 bg-white text-gray-900 hover:bg-gray-50">
          <SelectValue placeholder="Origin" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Origins</SelectItem>
          {uniqueOrigins.map((origin) => (
            <SelectItem key={origin} value={origin}>
              {origin}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.destination ?? 'all'}
        onValueChange={(value: string) => {
          if (value === 'all') {
            updateFilters({ destination: undefined });
          } else {
            updateFilters({ destination: value });
          }
        }}
      >
        <SelectTrigger className="h-11 rounded-lg border-2 border-[#0A5C3A]/20 bg-white text-gray-900 hover:bg-gray-50">
          <SelectValue placeholder="Destination" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Destinations</SelectItem>
          {uniqueDestinations.map((destination) => (
            <SelectItem key={destination} value={destination}>
              {destination}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            className="h-11 justify-start rounded-lg border-2 border-[#0A5C3A]/20 bg-white text-gray-900 hover:bg-gray-50 text-left font-normal px-3"
            variant="outline"
          >
            <span className="text-base mr-2">📅</span>
            {dateRange?.from ? (
              <span className="text-sm text-gray-700">
                {dateRange.to
                  ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
                  : formatDate(dateRange.from)}
              </span>
            ) : (
              <span className="text-sm text-gray-500">Select date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-4 bg-white border-2 border-[#0A5C3A]/20 shadow-lg">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Select Date Range</h3>
            <Calendar
              initialFocus
              mode="range"
              numberOfMonths={1}
              selected={dateRange}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  updateFilters({
                    dateRange: { from: range.from, to: range.to },
                  });
                }
              }}
              disabled={(date) => date > new Date()}
              className="rounded-lg"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ), [statusValue, modeValue, filters.origin, filters.destination, dateRange, uniqueOrigins, uniqueDestinations, updateFilters]);

  return (
    <div className="rounded-xl border-2 border-[#0A5C3A]/20 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0A5C3A]">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="text-gray-600 hover:text-[#0A5C3A] hover:bg-[#0A5C3A]/5"
            size="sm"
            variant="ghost"
            onClick={resetFilters}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>

          <Button
            className="md:hidden border-[#0A5C3A]/20 text-gray-600 bg-white hover:bg-gray-50"
            size="sm"
            variant="outline"
            onClick={() => {
              setOpenMobile((previous) => !previous);
            }}
          >
            <ChevronDown
              className={cn(
                'mr-2 h-4 w-4 transition-transform duration-200',
                openMobile && 'rotate-180'
              )}
            />
            {openMobile ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>

      <div className="mt-4 hidden md:block">{renderControls}</div>

      {openMobile && <div className="mt-4 space-y-3 md:hidden">{renderControls}</div>}
    </div>
  );
});
