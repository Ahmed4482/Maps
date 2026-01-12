import { format, parseISO } from 'date-fns';
import { ShipmentStatus, ShipmentMode } from '../types/shipment';

export function formatDate(date: Date | string, formatStr: string = 'MMM dd, yyyy'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
  } catch {
    return 'Invalid date';
  }
}

export function formatDatetime(date: Date | string, formatStr: string = 'MMM dd, yyyy HH:mm'): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
  } catch {
    return 'Invalid date';
  }
}

export function getStatusColor(status: ShipmentStatus): {
  bg: string;
  text: string;
  border: string;
  hoverBg?: string;
  hoverText?: string;
} {
  const colors = {
    delivered: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      hoverBg: 'hover:!bg-green-100',
      hoverText: 'hover:!text-green-800',
    },
    in_transit: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      hoverBg: 'hover:!bg-blue-100',
      hoverText: 'hover:!text-blue-800',
    },
    pending: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
      hoverBg: 'hover:!bg-yellow-100',
      hoverText: 'hover:!text-yellow-800',
    },
    closed: {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200',
      hoverBg: 'hover:!bg-gray-100',
      hoverText: 'hover:!text-gray-800',
    },
  };

  return colors[status];
}

export function getStatusLabel(status: ShipmentStatus): string {
  const labels = {
    delivered: 'Delivered',
    in_transit: 'In Transit',
    pending: 'Pending',
    closed: 'Closed',
  };

  return labels[status];
}

export function getModeIcon(mode: ShipmentMode): string {
  const icons = {
    FCL: '🚢',
    LCL: '📦',
    Air: '✈️',
    Road: '🚛',
  };

  return icons[mode];
}

export function getModeLabel(mode: ShipmentMode): string {
  const labels = {
    FCL: 'Full Container Load',
    LCL: 'Less than Container Load',
    Air: 'Air Freight',
    Road: 'Road Transport',
  };

  return labels[mode];
}

export interface RouteSegment {
  type: 'origin' | 'transit' | 'destination';
  location: string;
  date?: Date;
  icon: string;
}

export function getRouteSegments(
  origin: string,
  destination: string,
  milestones: Array<{ name: string; location: string; date: Date }>
): RouteSegment[] {
  const segments: RouteSegment[] = [];

  // Origin
  segments.push({
    type: 'origin',
    location: origin,
    icon: '📍',
    date: milestones[0]?.date,
  });

  // Transit points from milestones (excluding first and last)
  const transitMilestones = milestones.slice(1, -1);
  transitMilestones.forEach((milestone) => {
    segments.push({
      type: 'transit',
      location: milestone.location,
      date: milestone.date,
      icon: '📦',
    });
  });

  // Destination
  segments.push({
    type: 'destination',
    location: destination,
    icon: '🎯',
    date: milestones[milestones.length - 1]?.date,
  });

  return segments;
}

export function calculateShippingDays(createdDate: Date, deliveryDate: Date | undefined): number {
  if (!deliveryDate) {
    deliveryDate = new Date();
  }
  const diffTime = Math.abs(deliveryDate.getTime() - createdDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isExpectedDeliveryOverdue(estimatedDelivery: Date, status: ShipmentStatus): boolean {
  return status === 'in_transit' && estimatedDelivery < new Date();
}
