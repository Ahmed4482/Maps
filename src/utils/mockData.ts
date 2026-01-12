import { Shipment } from '../types/shipment';

const PORTS = [
  'Singapore',
  'Shanghai',
  'Hong Kong',
  'Rotterdam',
  'Dubai',
  'Los Angeles',
  'Hamburg',
  'New York',
  'Port Klang',
  'Busan',
  'Tokyo',
  'Antwerp',
  'Shenzen',
  'Xiamen',
  'Bangkok',
  'Houston',
  'Long Beach',
  'Kaohsiung',
  'Port Said',
  'Ningbo',
];

const CONSIGNEES = [
  'Acme Corporation',
  'Global Logistics Inc',
  'TechTrade Solutions',
  'Premium Imports Ltd',
  'International Commerce Co',
  'Advanced Shipments Group',
  'EuroTrade Partners',
  'Pacific Distribution Network',
  'Alliance Trading Corp',
  'Future Commerce Ltd',
];

const SHIPPERS = [
  'Orient Exports Ltd',
  'Global Supply Chain',
  'Premier Shipping Co',
  'Worldwide Distribution',
  'Continental Traders',
  'Eastern Export Corp',
  'Maritime Services Inc',
  'Trade Route Partners',
  'Summit Logistics Group',
  'International Movers',
];

const PRODUCTS = [
  'Electronics',
  'Textiles',
  'Machinery',
  'Chemicals',
  'Food Products',
  'Furniture',
  'Metal Products',
  'Automotive Parts',
  'Ceramics',
  'Plastics',
];

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOrderNumber(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

function generateBLNumber(): string {
  return `BL${Math.random().toString(36).substr(2, 10).toUpperCase()}`;
}

function generateMilestones(origin: string, destination: string, createdDate: Date): Milestone[] {
  const milestones: Milestone[] = [];
  const now = new Date();
  
  // Order Received
  milestones.push({
    id: '1',
    name: 'Order Received',
    date: createdDate,
    location: origin,
    status: 'completed',
  });

  // Picked up
  const pickupDate = new Date(createdDate.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000);
  milestones.push({
    id: '2',
    name: 'Picked Up',
    date: pickupDate,
    location: origin,
    status: pickupDate <= now ? 'completed' : 'upcoming',
  });

  // In Transit
  const transitDate = new Date(pickupDate.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000);
  milestones.push({
    id: '3',
    name: 'In Transit',
    date: transitDate,
    location: `Between ${origin} and ${destination}`,
    status: transitDate <= now ? 'completed' : transitDate.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000 ? 'current' : 'upcoming',
  });

  // Customs Clearance
  const customsDate = new Date(transitDate.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000);
  milestones.push({
    id: '4',
    name: 'Customs Clearance',
    date: customsDate,
    location: destination,
    status: customsDate <= now ? 'completed' : 'upcoming',
  });

  // Out for Delivery
  const deliveryDate = new Date(customsDate.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000);
  milestones.push({
    id: '5',
    name: 'Out for Delivery',
    date: deliveryDate,
    location: destination,
    status: deliveryDate <= now ? 'completed' : 'upcoming',
  });

  return milestones;
}

interface Milestone {
  id: string;
  name: string;
  date: Date;
  location: string;
  status: 'completed' | 'current' | 'upcoming';
}

export function generateMockShipments(count: number = 50): Shipment[] {
  const shipments: Shipment[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 60);

  for (let i = 0; i < count; i++) {
    const createdDate = randomDate(baseDate, new Date());
    const origin = getRandomElement(PORTS);
    let destination = getRandomElement(PORTS);
    while (destination === origin) {
      destination = getRandomElement(PORTS);
    }

    const modes = ['FCL', 'LCL', 'Air', 'Road'] as const;
    const statuses = ['delivered', 'in_transit', 'pending', 'closed'] as const;

    const milestones = generateMilestones(origin, destination, createdDate);
    const estimatedDelivery = new Date(createdDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);

    const status = getRandomElement(statuses);
    let actualDelivery: Date | undefined;
    if (status === 'delivered') {
      actualDelivery = new Date(estimatedDelivery.getTime() + (Math.random() - 0.5) * 5 * 24 * 60 * 60 * 1000);
    }

    shipments.push({
      id: `SHIP-${i + 1}`,
      orderNumber: generateOrderNumber(),
      blNumber: generateBLNumber(),
      mode: getRandomElement(modes),
      status,
      origin,
      destination,
      consignee: getRandomElement(CONSIGNEES),
      shipper: getRandomElement(SHIPPERS),
      createdDate,
      estimatedDelivery,
      actualDelivery,
      milestones,
      packages: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => ({
        id: `PKG-${i + 1}`,
        description: getRandomElement(PRODUCTS),
        weight: Math.floor(Math.random() * 1000) + 100,
        unit: 'kg' as const,
        quantity: Math.floor(Math.random() * 20) + 1,
      })),
      containers: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => ({
        id: `CNT-${i + 1}`,
        number: `CONT${Math.random().toString(36).substr(2, 10).toUpperCase()}`,
        type: Math.random() > 0.5 ? '20FT' : '40FT',
        sealNumber: `SEAL${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      })),
      is_pinned: Math.random() > 0.85,
    });
  }

  return shipments;
}
