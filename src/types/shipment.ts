export type ShipmentMode = 'FCL' | 'LCL' | 'Air' | 'Road';
export type ShipmentStatus = 'delivered' | 'in_transit' | 'pending' | 'closed';

export interface Milestone {
  id: string;
  name: string;
  date: Date;
  location: string;
  status: 'completed' | 'current' | 'upcoming';
}

export interface Package {
  id: string;
  description: string;
  weight: number;
  unit: 'kg' | 'lbs';
  quantity: number;
}

export interface Container {
  id: string;
  number: string;
  type: string;
  sealNumber: string;
}

export interface Shipment {
  id: string;
  orderNumber: string;
  blNumber: string;
  mode: ShipmentMode;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  consignee: string;
  shipper: string;
  customerRefNumber?: string;
  createdDate: Date;
  estimatedDelivery: Date;
  actualDelivery?: Date;
  milestones: Milestone[];
  packages: Package[];
  containers: Container[];
  is_pinned: boolean;
}

export interface ShipmentFilters {
  search?: string;
  status?: ShipmentStatus[];
  mode?: ShipmentMode[];
  origin?: string;
  destination?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
