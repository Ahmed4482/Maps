import { useState, useCallback, useEffect } from 'react';
import { Shipment, ShipmentFilters } from '../types/shipment';
import { fetchShipments as apiFetchShipments } from '../services/api';
import { useDebounce } from './useDebounce';

interface UseShipmentsOptions {
  pageSize?: number;
  initialFilters?: ShipmentFilters;
}

export function useShipments(options: UseShipmentsOptions = {}) {
  const { pageSize = 10, initialFilters = {} } = options;

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<ShipmentFilters>(initialFilters);
  const [search, setSearch] = useState('');

  // Debounce search input
  const debouncedSearch = useDebounce(search, 300);

  // Fetch shipments
  const fetchShipments = useCallback(
    async (pageNum: number = 1) => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiFetchShipments(pageNum, pageSize, {
          ...filters,
          search: debouncedSearch,
        });
        setShipments(response.data);
        setTotal(response.total);
        setPage(pageNum);
        setHasMore(response.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch shipments');
      } finally {
        setLoading(false);
      }
    },
    [pageSize, filters, debouncedSearch]
  );

  // Fetch when filters or search changes
  useEffect(() => {
    fetchShipments(1);
  }, [debouncedSearch, filters, fetchShipments]);

  // Handle pagination
  const goToPage = useCallback((pageNum: number) => {
    fetchShipments(pageNum);
  }, [fetchShipments]);

  const nextPage = useCallback(() => {
    if (hasMore) {
      goToPage(page + 1);
    }
  }, [page, hasMore, goToPage]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      goToPage(page - 1);
    }
  }, [page, goToPage]);

  // Handle search
  const handleSearch = useCallback((searchTerm: string) => {
    setSearch(searchTerm);
  }, []);

  // Handle filter updates
  const updateFilters = useCallback((newFilters: Partial<ShipmentFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setSearch('');
    setPage(1);
  }, [initialFilters]);

  return {
    shipments,
    loading,
    error,
    page,
    total,
    hasMore,
    pageSize,
    filters,
    search,
    fetchShipments: () => fetchShipments(page),
    handleSearch,
    updateFilters,
    resetFilters,
    goToPage,
    nextPage,
    prevPage,
  };
}
