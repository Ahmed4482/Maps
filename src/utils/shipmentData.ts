import { Shipment, Milestone, ShipmentStatus, ShipmentMode } from '../types/shipment';

export interface RoutePoint {
  coords: [number, number];
  milestone: Milestone | null;
  index: number;
  location?: string;
}

export interface ShipmentTrackingData {
  shipment_order_number: string;
  shipment_id: string;
  shipment_status: string;
  route_info: {
    origin: {
      port_name: string;
      port_code: string;
      coordinates: { latitude: number; longitude: number };
    };
    destination: {
      port_name: string;
      port_code: string;
      coordinates: { latitude: number; longitude: number };
    };
    transshipment_ports: Array<{
      port_name: string;
      port_code: string;
      port_city: string;
      port_country: string;
      coordinates: { latitude: number; longitude: number };
      arrival_date: string;
      departure_date: string;
      vessel_at_transshipment: string;
      vessel_imo: string;
    }>;
    route_type: 'direct' | 'transshipment';
  };
  route_coordinates: {
    completed_route: Array<{ latitude: number; longitude: number }>;
    remaining_route: Array<{ latitude: number; longitude: number }>;
  };
  current_position: {
    latitude: number;
    longitude: number;
    location_name: string;
    timestamp: string;
    vessel_name: string | null;
    vessel_imo: string | null;
    status: string;
    current_leg: number;
  };
}
import { parseISO } from 'date-fns';
import shipmentsListData from '../data/shipmentsList.json';
import shipmentDetailsData from '../data/shipmentDetails.json';
import shipmentTrackingData from '../data/shipmentTracking.json';

// Type definitions for JSON data structure
interface JsonMilestone {
  milestone_type_display: string;
  milestone_type: number;
  start_date: string | null;
  status: string | null;
  location?: string;
}

interface JsonPackage {
  package_type: string;
  number_of_packages: string;
}

interface JsonContainer {
  type: string;
  quantity: number;
}

interface JsonShipment {
  id: string;
  shipment_order_number: string;
  master_bill_of_lading_number: string | null;
  house_bill_of_lading_number: string | null;
  consignment_mode: string;
  item_description: string;
  customer_ref_number: string;
  consignee_name: string;
  shipper_name: string;
  origin: string;
  destination: string;
  shipment_milestones: JsonMilestone[];
  packages: JsonPackage[];
  containers: JsonContainer[];
  is_pinned: boolean;
  status: string;
  status_updated_at: string;
}

// Exact port coordinates for sea route calculation
const PORT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Brazil Ports
  "SANTOS, BRAZIL": { lat: -23.9608, lng: -46.3339 },
  "SANTOS": { lat: -23.9608, lng: -46.3339 },
  
  // India Ports
  "MUNDRA": { lat: 22.8394, lng: 69.7197 },
  "MUNDRA, INDIA": { lat: 22.8394, lng: 69.7197 },
  "NHAVA SHEVA": { lat: 18.9480, lng: 72.9508 },
  "MUMBAI": { lat: 18.9388, lng: 72.8354 },
  
  // Pakistan Ports
  "MUHAMMAD BIN QASIM (PORT QASIM), PAKISTAN": { lat: 24.7854, lng: 67.3480 },
  "PORT QASIM": { lat: 24.7854, lng: 67.3480 },
  "KARACHI": { lat: 24.8414, lng: 67.0011 },
  "KARACHI, PAKISTAN": { lat: 24.8414, lng: 67.0011 },
  
  // UAE Ports
  "JEBEL ALI": { lat: 25.0118, lng: 55.1121 },
  "DUBAI": { lat: 25.2769, lng: 55.2962 },
  "DUBAI, UAE": { lat: 25.2769, lng: 55.2962 },
  
  // Singapore
  "SINGAPORE": { lat: 1.2644, lng: 103.8224 },
  
  // China Ports
  "SHANGHAI": { lat: 31.2304, lng: 121.4737 },
  "SHANGHAI, CHINA": { lat: 31.2304, lng: 121.4737 },
  "NINGBO": { lat: 29.8683, lng: 121.5440 },
  "NINGBO, CHINA": { lat: 29.8683, lng: 121.5440 },
  "SHENZHEN": { lat: 22.5431, lng: 114.0579 },
  "SHENZHEN, CHINA": { lat: 22.5431, lng: 114.0579 },
  "QINGDAO, CHINA": { lat: 36.0667, lng: 120.3833 },
  
  // USA Ports
  "LOS ANGELES": { lat: 33.7405, lng: -118.2720 },
  "LOS ANGELES, USA": { lat: 33.7405, lng: -118.2720 },
  "LONG BEACH": { lat: 33.7553, lng: -118.2256 },
  "NEW YORK": { lat: 40.6635, lng: -74.0354 },
  "NEW YORK, USA": { lat: 40.6635, lng: -74.0354 },
  
  // Europe Ports
  "ROTTERDAM": { lat: 51.9244, lng: 4.4777 },
  "HAMBURG": { lat: 53.5395, lng: 9.9847 },
  "ANTWERP": { lat: 51.2894, lng: 4.3053 },
};

// Geocoding utility - maps common ports/cities to coordinates (legacy, use PORT_COORDINATES for ports)
const LOCATION_COORDINATES: Record<string, [number, number]> = {
  // China
  'QINGDAO, CHINA': [36.0667, 120.3833],
  'SHANGHAI, CHINA': [31.2304, 121.4737],
  'NINGBO, CHINA': [29.8683, 121.5440],
  'GUANGZHOU, CHINA': [23.1291, 113.2644],
  'SHENZHEN, CHINA': [22.5431, 114.0579],
  
  // Pakistan
  'KARACHI, PAKISTAN': [24.8607, 67.0011],
  'PORT QASIM, PAKISTAN': [24.7667, 67.3333],
  'MUHAMMAD BIN QASIM (PORT QASIM), PAKISTAN': [24.7667, 67.3333],
  
  // UAE
  'KHALIFA, ABU DHABI': [24.4539, 54.3773],
  'DUBAI, UAE': [25.2048, 55.2708],
  
  // Thailand
  'LAEM CHABANG, THAILAND': [13.0833, 100.8833],
  'BANGKOK, THAILAND': [13.7563, 100.5018],
  
  // South Korea
  'BUSAN, SOUTH KOREA': [35.1796, 129.0756],
  'SEOUL, SOUTH KOREA': [37.5665, 126.9780],
  
  // USA
  'NORFLOK, USA': [36.8468, -76.2852],
  'NORFOLK, USA': [36.8468, -76.2852],
  'NEW YORK, USA': [40.7128, -74.0060],
  'LOS ANGELES, USA': [34.0522, -118.2437],
  
  // Brazil
  'SANTOS, BRAZIL': [-23.9608, -46.3331],
  'SAO PAULO, BRAZIL': [-23.5505, -46.6333],
  
  // India
  'MUNDRA': [22.8397, 69.7214],
  'MUMBAI, INDIA': [19.0760, 72.8777],
  
  // Qatar
  'MESAIEED, QATAR': [24.9924, 51.5472],
  'DOHA, QATAR': [25.2854, 51.5310],
};

// Get coordinates for a location string - prioritize PORT_COORDINATES for exact port locations
export function getLocationCoordinates(location: string): [number, number] | null {
  const normalized = location.toUpperCase().trim();
  
  // First check PORT_COORDINATES for exact port matches
  if (PORT_COORDINATES[normalized]) {
    return [PORT_COORDINATES[normalized].lat, PORT_COORDINATES[normalized].lng];
  }
  
  // Try partial match in PORT_COORDINATES
  for (const [key, coords] of Object.entries(PORT_COORDINATES)) {
    const keyNormalized = key.toUpperCase();
    if (normalized.includes(keyNormalized.split(',')[0]) || keyNormalized.includes(normalized.split(',')[0])) {
      return [coords.lat, coords.lng];
    }
  }
  
  // Fallback to LOCATION_COORDINATES
  if (LOCATION_COORDINATES[normalized]) {
    return LOCATION_COORDINATES[normalized];
  }
  
  // Try partial match in LOCATION_COORDINATES
  for (const [key, coords] of Object.entries(LOCATION_COORDINATES)) {
    if (normalized.includes(key.split(',')[0]) || key.includes(normalized.split(',')[0])) {
      return coords;
    }
  }
  
  // Fallback: hash-based deterministic coordinates
  let hash = 0;
  for (let i = 0; i < location.length; i++) {
    hash = (hash << 5) - hash + location.charCodeAt(i);
    hash |= 0;
  }
  const lat = ((hash % 12000) / 100) - 60;
  const lng = (((hash >> 3) % 34000) / 100) - 170;
  return [lat, lng];
}

// Transform JSON milestone to Shipment milestone
function transformMilestone(
  jsonMilestone: JsonMilestone,
  index: number,
  allMilestones: JsonMilestone[],
  origin: string,
  destination: string
): Milestone {
  const hasDate = jsonMilestone.start_date !== null;
  const date = hasDate ? parseISO(jsonMilestone.start_date!) : new Date();
  
  // Derive location from milestone type since shipmentsList.json doesn't include location field
  // Milestones 0 & 1 (Empty to shipper, Departure from POL) → use origin
  // Milestones 2 & 3 (Arrival at POD, Delivery to consignee) → use destination
  let location = '';
  if (jsonMilestone.milestone_type === 0 || jsonMilestone.milestone_type === 1) {
    location = origin;
  } else if (jsonMilestone.milestone_type === 2 || jsonMilestone.milestone_type === 3) {
    location = destination;
  } else {
    // For other milestone types, use provided location or default
    location = jsonMilestone.location || 'In Transit';
  }
  
  // Determine status based on milestone type and date
  let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
  const now = new Date();
  
  if (hasDate) {
    if (date <= now) {
      status = 'completed';
    } else {
      // Check if this is the next upcoming milestone
      const completedCount = allMilestones.filter(
        (m, idx) => idx < index && m.start_date !== null && parseISO(m.start_date!) <= now
      ).length;
      
      if (completedCount === index) {
        status = 'current';
      }
    }
  } else {
    // No date means upcoming
    const completedCount = allMilestones.filter(
      (m, idx) => idx < index && m.start_date !== null && parseISO(m.start_date!) <= now
    ).length;
    
    if (completedCount === index) {
      status = 'current';
    }
  }
  
  return {
    id: `milestone-${index}`,
    name: jsonMilestone.milestone_type_display,
    date,
    location,
    status,
  };
}

// Transform JSON shipment to Shipment type
export function transformJsonShipment(jsonShipment: JsonShipment): Shipment {
  // Transform milestones - ALWAYS show all milestones, derive location from milestone type
  // shipmentsList.json milestones don't have location field, so we derive it:
  // Milestones 0 & 1 → origin, Milestones 2 & 3 → destination
  const milestones = jsonShipment.shipment_milestones.map((m, idx, all) => {
    return transformMilestone(
      m,
      idx,
      all,
      jsonShipment.origin || 'Unknown',
      jsonShipment.destination || 'Unknown'
    );
  });
  // DO NOT FILTER - keep all milestones!
  
  // Get BL number (prefer master, fallback to house)
  const blNumber = jsonShipment.master_bill_of_lading_number || 
                   jsonShipment.house_bill_of_lading_number || 
                   'N/A';
  
  // Transform packages
  const packages = jsonShipment.packages.map((pkg, idx) => ({
    id: `pkg-${idx}`,
    description: pkg.package_type,
    weight: parseFloat(pkg.number_of_packages) * 10, // Estimate weight
    unit: 'kg' as const,
    quantity: parseFloat(pkg.number_of_packages),
  }));
  
  // Transform containers
  const containers = jsonShipment.containers.flatMap((cnt, idx) =>
    Array.from({ length: cnt.quantity }, (_, i) => ({
      id: `cnt-${idx}-${i}`,
      number: `CNT-${jsonShipment.shipment_order_number}-${idx}-${i}`,
      type: cnt.type,
      sealNumber: `SEAL-${idx}-${i}`,
    }))
  );
  
  // Determine created date from first milestone
  const firstMilestone = jsonShipment.shipment_milestones.find((m) => m.start_date);
  const createdDate = firstMilestone?.start_date 
    ? parseISO(firstMilestone.start_date)
    : parseISO(jsonShipment.status_updated_at);
  
  // Estimate delivery date from last milestone or status
  const lastMilestone = [...jsonShipment.shipment_milestones].reverse().find((m) => m.start_date);
  const estimatedDelivery = lastMilestone?.start_date
    ? parseISO(lastMilestone.start_date)
    : new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
  
  // Normalize status
  const statusMap: Record<string, ShipmentStatus> = {
    delivered: 'delivered',
    in_transit: 'in_transit',
    pending: 'pending',
    closed: 'closed',
  };
  
  const normalizedStatus = statusMap[jsonShipment.status.toLowerCase()] || 'pending';
  
  // Normalize mode
  const modeMap: Record<string, ShipmentMode> = {
    fcl: 'FCL',
    lcl: 'LCL',
    air: 'Air',
    road: 'Road',
  };
  
  const normalizedMode = modeMap[jsonShipment.consignment_mode.toLowerCase()] || 'FCL';
  
  return {
    id: jsonShipment.id,
    orderNumber: jsonShipment.shipment_order_number,
    blNumber,
    mode: normalizedMode,
    status: normalizedStatus,
    origin: jsonShipment.origin,
    destination: jsonShipment.destination,
    consignee: jsonShipment.consignee_name,
    shipper: jsonShipment.shipper_name,
    customerRefNumber: jsonShipment.customer_ref_number,
    createdDate,
    estimatedDelivery,
    actualDelivery: normalizedStatus === 'delivered' ? estimatedDelivery : undefined,
    milestones,
    packages,
    containers,
    is_pinned: jsonShipment.is_pinned,
  };
}

// Load and transform all shipments from JSON
export function loadShipmentsFromJson(): Shipment[] {
  const jsonData = shipmentsListData as { results: JsonShipment[] };
  return jsonData.results.map(transformJsonShipment);
}

// Extract country name from location string
function extractCountry(location: string): string {
  const parts = location.split(',').map(p => p.trim());
  // Last part is usually the country
  return parts[parts.length - 1] || location;
}

// Get approximate country center coordinates
function getCountryCenterCoordinates(country: string): [number, number] | null {
  const normalized = country.toUpperCase().trim();
  
  // Country center coordinates (approximate)
  const countryCenters: Record<string, [number, number]> = {
    'CHINA': [35.8617, 104.1954],
    'PAKISTAN': [30.3753, 69.3451],
    'UAE': [23.4241, 53.8478],
    'UNITED ARAB EMIRATES': [23.4241, 53.8478],
    'THAILAND': [15.8700, 100.9925],
    'SOUTH KOREA': [35.9078, 127.7669],
    'KOREA': [35.9078, 127.7669],
    'USA': [37.0902, -95.7129],
    'UNITED STATES': [37.0902, -95.7129],
    'BRAZIL': [-14.2350, -51.9253],
    'INDIA': [20.5937, 78.9629],
    'QATAR': [25.3548, 51.1839],
  };
  
  // Direct match
  if (countryCenters[normalized]) {
    return countryCenters[normalized];
  }
  
  // Partial match
  for (const [key, coords] of Object.entries(countryCenters)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  
  return null;
}

// Calculate sea waypoints between two points (ensures route goes over water)
function calculateSeaWaypoints(
  point1: [number, number],
  point2: [number, number]
): Array<[number, number]> {
  const waypoints: Array<[number, number]> = [];
  
  // Calculate bearing and distance
  const lat1 = point1[0] * Math.PI / 180;
  const lat2 = point2[0] * Math.PI / 180;
  const dLng = (point2[1] - point1[1]) * Math.PI / 180;
  
  // Calculate distance
  const a = Math.sin((lat2 - lat1) / 2) ** 2 + 
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = 6371 * c; // Distance in km
  
  // For long routes, add multiple waypoints over ocean
  if (distance > 5000) {
    // Very long route - add 2 waypoints
    const waypoint1 = [
      point1[0] + (point2[0] - point1[0]) * 0.33,
      point1[1] + (point2[1] - point1[1]) * 0.33
    ] as [number, number];
    const waypoint2 = [
      point1[0] + (point2[0] - point1[0]) * 0.67,
      point1[1] + (point2[1] - point1[1]) * 0.67
    ] as [number, number];
    
    // Adjust to be more over water - move towards equator for open ocean
    waypoint1[0] = waypoint1[0] * 0.85; // Move 15% towards equator
    waypoint2[0] = waypoint2[0] * 0.85;
    
    waypoints.push(waypoint1, waypoint2);
  } else if (distance > 2000) {
    // Medium route - add 1 waypoint
    const waypoint = [
      point1[0] + (point2[0] - point1[0]) * 0.5,
      point1[1] + (point2[1] - point1[1]) * 0.5
    ] as [number, number];
    
    // Adjust to be more over water
    waypoint[0] = waypoint[0] * 0.9; // Move 10% towards equator
    
    waypoints.push(waypoint);
  }
  // Short routes don't need waypoints
  
  return waypoints;
}

// Get coastal point for a country (approximate port location)
function getCoastalPoint(country: string, isOrigin: boolean): [number, number] | null {
  const normalized = country.toUpperCase().trim();
  
  // Major port coordinates (coastal points)
  const coastalPoints: Record<string, [number, number]> = {
    'CHINA': isOrigin ? [31.2304, 121.4737] : [36.0667, 120.3833], // Shanghai or Qingdao
    'PAKISTAN': [24.8607, 67.0011], // Karachi
    'UAE': [25.2048, 55.2708], // Dubai
    'UNITED ARAB EMIRATES': [25.2048, 55.2708],
    'THAILAND': [13.0833, 100.8833], // Laem Chabang
    'SOUTH KOREA': [35.1796, 129.0756], // Busan
    'KOREA': [35.1796, 129.0756],
    'USA': isOrigin ? [34.0522, -118.2437] : [40.7128, -74.0060], // LA or NY
    'UNITED STATES': isOrigin ? [34.0522, -118.2437] : [40.7128, -74.0060],
    'BRAZIL': [-23.9608, -46.3331], // Santos
    'INDIA': [19.0760, 72.8777], // Mumbai
    'QATAR': [25.2854, 51.5310], // Doha
  };
  
  if (coastalPoints[normalized]) {
    return coastalPoints[normalized];
  }
  
  // Partial match
  for (const [key, coords] of Object.entries(coastalPoints)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  
  return null;
}

// Get coordinates from shipmentDetails.json using latitude/longitude from milestones
// Falls back to PORT_COORDINATES if lat/lng not available
// Adds sea waypoints between ports to ensure routes go over water
export function getShipmentRouteCoordinatesFromDetails(shipmentId: string): Array<RoutePoint> {
  const routePoints: Array<RoutePoint> = [];
  
  try {
    // Type assertion for shipmentDetails.json structure
    const detailsData = shipmentDetailsData as any;
    
    // Check if this is the shipment we're looking for
    if (detailsData.id !== shipmentId) {
      return routePoints;
    }
    
    // Filter milestones that have location (we'll use lat/lng if available, otherwise PORT_COORDINATES)
    const milestonesWithLocation = detailsData.shipment_milestones.filter(
      (m: any) => m.location !== null && m.location !== undefined
    );
    
    // Sort by start_date to maintain order
    milestonesWithLocation.sort((a: any, b: any) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });
    
    // Create route points from milestones
    const portPoints: Array<RoutePoint> = [];
    milestonesWithLocation.forEach((milestone: any, index: number) => {
      let coords: [number, number] | null = null;
      
      // First priority: use lat/lng if available
      if (milestone.latitude !== null && milestone.longitude !== null && 
          typeof milestone.latitude === 'number' && typeof milestone.longitude === 'number') {
        coords = [milestone.latitude, milestone.longitude];
      } else {
        // Fallback: use PORT_COORDINATES based on location
        coords = getLocationCoordinates(milestone.location);
      }
      
      if (coords) {
        portPoints.push({
          coords: coords,
          milestone: null,
          index: index,
          location: milestone.location || 'Unknown',
        });
      }
    });
    
    // Add port points and sea waypoints between them
    portPoints.forEach((portPoint, index) => {
      // Add the port point
      routePoints.push(portPoint);
      
      // Add sea waypoints between this port and the next one
      if (index < portPoints.length - 1) {
        const nextPort = portPoints[index + 1];
        const seaWaypoints = calculateSeaWaypoints(portPoint.coords, nextPort.coords);
        
        seaWaypoints.forEach((waypoint, waypointIndex) => {
          routePoints.push({
            coords: waypoint,
            milestone: null,
            index: index * 100 + waypointIndex + 1, // Use large index to keep waypoints between ports
            location: 'Sea Route',
          });
        });
      }
    });
    
    return routePoints;
  } catch (error) {
    console.error('Error loading route from shipmentDetails.json:', error);
    return routePoints;
  }
}

// Get tracking data from shipmentTracking.json
export function getShipmentTrackingData(shipmentIdOrOrderNumber: string): ShipmentTrackingData | null {
  try {
    const trackingData = shipmentTrackingData as { shipments: ShipmentTrackingData[] };
    const shipment = trackingData.shipments.find(
      (s) => s.shipment_id === shipmentIdOrOrderNumber || s.shipment_order_number === shipmentIdOrOrderNumber
    );
    return shipment || null;
  } catch (error) {
    console.error('Error loading tracking data:', error);
    return null;
  }
}

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find closest sea waypoint from route coordinates to a given point
function findClosestSeaWaypoint(
  targetLat: number,
  targetLon: number,
  routePoints: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } | null {
  if (!routePoints || routePoints.length === 0) return null;
  
  let minDistance = Infinity;
  let closestPoint = routePoints[0];
  
  for (const point of routePoints) {
    const distance = calculateDistance(targetLat, targetLon, point.lat, point.lng);
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = point;
    }
  }
  
  return closestPoint;
}

// Get tracking data structure for map visualization
export function getShipmentTrackingForMap(shipment: Shipment) {
  const trackingData = getShipmentTrackingData(shipment.id || shipment.orderNumber);
  if (!trackingData) return null;
  
  const completedRoute = trackingData.route_coordinates.completed_route.map((p) => ({
    lat: p.latitude,
    lng: p.longitude,
  }));
  const remainingRoute = trackingData.route_coordinates.remaining_route.map((p) => ({
    lat: p.latitude,
    lng: p.longitude,
  }));
  
  const currentPosition = {
    lat: trackingData.current_position.latitude,
    lng: trackingData.current_position.longitude,
    vesselName: trackingData.current_position.vessel_name,
    vesselImo: trackingData.current_position.vessel_imo,
    status: trackingData.current_position.status,
    locationName: trackingData.current_position.location_name,
    timestamp: trackingData.current_position.timestamp,
  };
  
  // Determine vessel marker position based on shipment status
  // If at origin (completed_route empty), use first point of remaining_route as closest sea waypoint
  // If at destination (remaining_route empty or status is delivered/closed), use last point of completed_route
  // Otherwise, use current position
  let vesselPosition = { lat: currentPosition.lat, lng: currentPosition.lng };
  const isAtOrigin = completedRoute.length === 0;
  const isAtDestination = remainingRoute.length === 0 || 
    ['delivered', 'closed'].includes(trackingData.shipment_status.toLowerCase());
  
  if (isAtOrigin && remainingRoute.length > 0) {
    // Ship is at origin, use first point of remaining_route (closest sea waypoint to origin)
    vesselPosition = remainingRoute[0];
  } else if (isAtDestination && completedRoute.length > 0) {
    // Ship has reached destination, use last point of completed_route (closest sea waypoint to destination)
    vesselPosition = completedRoute[completedRoute.length - 1];
  } else if (remainingRoute.length > 0) {
    // Ship is in transit, find closest sea waypoint to current position from remaining_route
    const closestWaypoint = findClosestSeaWaypoint(
      currentPosition.lat,
      currentPosition.lng,
      remainingRoute
    );
    if (closestWaypoint) {
      vesselPosition = closestWaypoint;
    }
  } else if (completedRoute.length > 0) {
    // Fallback: find closest sea waypoint from completed_route
    const closestWaypoint = findClosestSeaWaypoint(
      currentPosition.lat,
      currentPosition.lng,
      completedRoute
    );
    if (closestWaypoint) {
      vesselPosition = closestWaypoint;
    }
  }
  
  return {
    completedRoute,
    remainingRoute,
    currentPosition: {
      ...currentPosition,
      // Override position with closest sea waypoint
      lat: vesselPosition.lat,
      lng: vesselPosition.lng,
    },
    ports: {
      origin: {
        lat: trackingData.route_info.origin.coordinates.latitude,
        lng: trackingData.route_info.origin.coordinates.longitude,
        name: trackingData.route_info.origin.port_name,
        code: trackingData.route_info.origin.port_code,
      },
      destination: {
        lat: trackingData.route_info.destination.coordinates.latitude,
        lng: trackingData.route_info.destination.coordinates.longitude,
        name: trackingData.route_info.destination.port_name,
        code: trackingData.route_info.destination.port_code,
      },
      transshipment: trackingData.route_info.transshipment_ports.map((port) => ({
        lat: port.coordinates.latitude,
        lng: port.coordinates.longitude,
        name: port.port_name,
        code: port.port_code,
        city: port.port_city,
        country: port.port_country,
        arrivalDate: port.arrival_date,
        departureDate: port.departure_date,
        vesselName: port.vessel_at_transshipment,
        vesselImo: port.vessel_imo,
      })),
    },
  };
}

// Get coordinates for a shipment's route - Try shipmentTracking.json first, then shipmentDetails.json, then calculated route
export function getShipmentRouteCoordinates(shipment: Shipment): Array<RoutePoint> {
  // NEW: First, try to get coordinates from shipmentTracking.json
  const trackingData = getShipmentTrackingData(shipment.id || shipment.orderNumber);
  if (trackingData && trackingData.route_coordinates) {
    const routePoints: Array<RoutePoint> = [];
    let index = 0;
    
    // Add completed route points
    trackingData.route_coordinates.completed_route.forEach((point) => {
      routePoints.push({
        coords: [point.latitude, point.longitude],
        milestone: null,
        index: index++,
        location: 'Completed Route',
      });
    });
    
    // Add remaining route points
    trackingData.route_coordinates.remaining_route.forEach((point) => {
      routePoints.push({
        coords: [point.latitude, point.longitude],
        milestone: null,
        index: index++,
        location: 'Remaining Route',
      });
    });
    
    if (routePoints.length > 0) {
      return routePoints;
    }
  }
  
  // Fallback: Try to get coordinates from shipmentDetails.json
  const detailsRoute = getShipmentRouteCoordinatesFromDetails(shipment.id);
  if (detailsRoute.length > 0) {
    return detailsRoute;
  }
  
  // Fallback to calculated route if no details available
  const routePoints: Array<RoutePoint> = [];
  
  // Get origin and destination coordinates
  const originCoords = getLocationCoordinates(shipment.origin);
  const destCoords = getLocationCoordinates(shipment.destination);
  
  if (!originCoords || !destCoords) {
    return routePoints;
  }
  
  // Extract countries
  const originCountry = extractCountry(shipment.origin);
  const destCountry = extractCountry(shipment.destination);
  
  // Get coastal points (ports) for countries
  const originCoastal = getCoastalPoint(originCountry, true) || originCoords;
  const destCoastal = getCoastalPoint(destCountry, false) || destCoords;
  
  // Point 1: Origin
  routePoints.push({
    coords: originCoords,
    milestone: null,
    index: 0,
  });
  
  // Point 2: Origin Coastal Point (if different from origin)
  let currentIndex = 1;
  if (Math.abs(originCoastal[0] - originCoords[0]) > 0.5 || 
      Math.abs(originCoastal[1] - originCoords[1]) > 0.5) {
    routePoints.push({
      coords: originCoastal,
      milestone: null,
      index: currentIndex++,
    });
  }
  
  // Add Sea Waypoints (over ocean)
  const seaWaypoints = calculateSeaWaypoints(originCoastal, destCoastal);
  seaWaypoints.forEach((waypoint) => {
    routePoints.push({
      coords: waypoint,
      milestone: null,
      index: currentIndex++,
    });
  });
  
  // Destination Coastal Point (if different from destination)
  if (Math.abs(destCoastal[0] - destCoords[0]) > 0.5 || 
      Math.abs(destCoastal[1] - destCoords[1]) > 0.5) {
    routePoints.push({
      coords: destCoastal,
      milestone: null,
      index: currentIndex++,
    });
  }
  
  // Final Destination
  routePoints.push({
    coords: destCoords,
    milestone: null,
    index: currentIndex,
  });
  
  return routePoints;
}

