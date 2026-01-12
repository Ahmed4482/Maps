import { Shipment, ShipmentFilters, PaginatedResponse } from '../types/shipment';
import { loadShipmentsFromJson } from '../utils/shipmentData';

// Initialize shipments from JSON data
let allShipments: Shipment[] = [];
let initialized = false;

function initializeShipments() {
  if (!initialized) {
    allShipments = loadShipmentsFromJson();
    initialized = true;
  }
}

// Simulate API delay
const API_DELAY = 300;

function delay(ms: number = API_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function searchShipments(shipments: Shipment[], searchTerm: string): Shipment[] {
  if (!searchTerm.trim()) return shipments;

  const term = searchTerm.toLowerCase().trim();
  return shipments.filter(
    (shipment) =>
      shipment.orderNumber.toLowerCase().includes(term) ||
      shipment.blNumber.toLowerCase().includes(term) ||
      shipment.consignee.toLowerCase().includes(term) ||
      shipment.shipper.toLowerCase().includes(term) ||
      shipment.customerRefNumber?.toLowerCase().includes(term) ||
      shipment.origin.toLowerCase().includes(term) ||
      shipment.destination.toLowerCase().includes(term)
  );
}

function applyFilters(shipments: Shipment[], filters: ShipmentFilters): Shipment[] {
  let filtered = shipments;

  if (filters.status && filters.status.length > 0) {
    filtered = filtered.filter((s) => filters.status?.includes(s.status));
  }

  if (filters.mode && filters.mode.length > 0) {
    filtered = filtered.filter((s) => filters.mode?.includes(s.mode));
  }

  if (filters.origin) {
    filtered = filtered.filter((s) =>
      s.origin.toLowerCase().includes(filters.origin!.toLowerCase())
    );
  }

  if (filters.destination) {
    filtered = filtered.filter((s) =>
      s.destination.toLowerCase().includes(filters.destination!.toLowerCase())
    );
  }

  if (filters.dateRange) {
    filtered = filtered.filter(
      (s) =>
        s.createdDate >= filters.dateRange!.from &&
        s.createdDate <= filters.dateRange!.to
    );
  }

  return filtered;
}

export async function fetchShipments(
  page: number = 1,
  pageSize: number = 50,
  filters: ShipmentFilters = {}
): Promise<PaginatedResponse<Shipment>> {
  await delay();

  initializeShipments();
  let results = [...allShipments];

  // Apply filters
  results = applyFilters(results, filters);

  // Apply search
  if (filters.search) {
    results = searchShipments(results, filters.search);
  }

  // Sort by created date descending (most recent first)
  results = results.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());

  // Sort pinned shipments first
  results = results.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return 0;
  });

  const total = results.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const data = results.slice(startIndex, endIndex);

  return {
    data,
    total,
    page,
    pageSize,
    hasMore: endIndex < total,
  };
}

export async function fetchShipmentById(id: string): Promise<Shipment | null> {
  await delay();

  initializeShipments();
  const shipment = allShipments.find((s) => s.id === id);
  return shipment || null;
}

export async function updateShipmentPin(id: string, isPinned: boolean): Promise<boolean> {
  await delay(200);

  initializeShipments();
  const shipment = allShipments.find((s) => s.id === id);
  if (shipment) {
    shipment.is_pinned = isPinned;
    return true;
  }

  return false;
}

export async function getPinnedShipments(): Promise<Shipment[]> {
  await delay();
  initializeShipments();
  return allShipments
    .filter((s) => s.is_pinned)
    .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
}
