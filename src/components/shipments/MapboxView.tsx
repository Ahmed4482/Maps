import { useEffect, useMemo, useRef, useState } from 'react';
import { Shipment } from '@/types/shipment';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getStatusColor, getStatusLabel, formatDate } from '@/utils/helpers';
import { MapPin, Package, Clock4, Ship, Plane, Truck, Layers, Fullscreen, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getShipmentRouteCoordinates, getShipmentTrackingForMap } from '@/utils/shipmentData';
import { getCityPhoto } from '@/services/unsplash';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Extract country name from location string
function extractCountry(location: string): string {
  const parts = location.split(',').map(p => p.trim());
  return parts[parts.length - 1] || location;
}

interface MapboxViewProps {
  shipments: Shipment[];
  selectedShipmentId?: string | null;
  onSelect?: (shipment: Shipment) => void;
}

export function MapboxView({ shipments, selectedShipmentId, onSelect }: MapboxViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'satellite-streets' | 'outdoors'>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);

  const activeShipment = useMemo(
    () => shipments.find((s) => s.id === expandedId) ?? null,
    [expandedId, shipments]
  );

  // Pagination calculations
  const totalPages = Math.ceil(shipments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedShipments = shipments.slice(startIndex, endIndex);

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Clear expansion if expanded shipment is not on current page
  useEffect(() => {
    if (expandedId && !paginatedShipments.find(s => s.id === expandedId)) {
      setExpandedId(null);
      setActiveId(null);
    }
  }, [currentPage, expandedId, paginatedShipments]);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_KEY;
    if (!mapboxToken) {
      setMapError('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    // Style Mapbox popup close button
    let styleElement = document.getElementById('mapbox-popup-close-style');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'mapbox-popup-close-style';
      styleElement.textContent = `
        .mapboxgl-popup-close-button {
          width: 28px !important;
          height: 28px !important;
          font-size: 20px !important;
          color: white !important;
          background: rgba(255,255,255,0.2) !important;
          border-radius: 8px !important;
          top: 12px !important;
          right: 12px !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s !important;
          line-height: 1 !important;
          font-weight: bold !important;
        }
        .mapboxgl-popup-close-button:hover {
          background: rgba(255,255,255,0.3) !important;
        }
        .mapboxgl-popup-close-button:focus {
          outline: none !important;
        }
        /* Hide Mapbox popup tip/pointer (the square box behind popup) */
        .mapboxgl-popup-tip {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
          border: none !important;
        }
        .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip,
        .mapboxgl-popup-anchor-top .mapboxgl-popup-tip,
        .mapboxgl-popup-anchor-left .mapboxgl-popup-tip,
        .mapboxgl-popup-anchor-right .mapboxgl-popup-tip,
        .mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip,
        .mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip,
        .mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip,
        .mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
          border: none !important;
        }
        /* Remove default Mapbox popup content background and wrapper */
        .mapboxgl-popup-content {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border: none !important;
        }
        .mapboxgl-popup {
          pointer-events: none !important;
          background: transparent !important;
          z-index: 50 !important;
        }
        .mapboxgl-popup-content {
          pointer-events: auto !important;
        }
        /* Hide any background elements */
        .mapboxgl-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border: none !important;
        }
        /* Ensure no background on popup container and all wrapper elements */
        .mapboxgl-popup-container {
          background: transparent !important;
        }
        /* Target all possible popup background elements - remove any white/colored backgrounds */
        .mapboxgl-popup > div {
          background: transparent !important;
        }
        .mapboxgl-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
        }
        /* Remove any default Mapbox styling that creates rectangles */
        .mapboxgl-popup-content-wrapper::before,
        .mapboxgl-popup-content-wrapper::after {
          display: none !important;
        }
      `;
      document.head.appendChild(styleElement);
    }

    try {
      const styleMap: Record<'streets' | 'satellite' | 'satellite-streets' | 'outdoors', string> = {
        streets: 'mapbox://styles/mapbox/streets-v12',
        satellite: 'mapbox://styles/mapbox/satellite-v9',
        'satellite-streets': 'mapbox://styles/mapbox/satellite-streets-v12',
        outdoors: 'mapbox://styles/mapbox/outdoors-v12',
      };

      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: styleMap[mapStyle],
        center: [67.0011, 24.8607], // Karachi
        zoom: 3,
      });

      mapRef.current.on('error', () => {
        setMapError('Failed to load Mapbox. Please check your connection.');
      });

      // Close popups when clicking on the map
      mapRef.current.on('click', (e) => {
        // Only close if clicking directly on map (not on popup or marker)
        const target = e.originalEvent.target as HTMLElement;
        if (target && !target.closest('.mapboxgl-popup') && !target.closest('.mapboxgl-marker')) {
          popupsRef.current.forEach((popup) => {
            if (popup && popup.isOpen()) {
              popup.remove();
            }
          });
        }
      });
    } catch (err) {
      setMapError('Mapbox initialization error');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [mapStyle]);

  // Render route and markers for active shipment
  useEffect(() => {
    if (!mapRef.current || !activeShipment) {
      // Clear markers and popups when no shipment is selected
      markersRef.current.forEach(marker => marker.remove());
      popupsRef.current.forEach(popup => popup.remove());
      markersRef.current = [];
      popupsRef.current = [];

      // Also clear any route lines when shipment is closed/unselected
      ['completed-route', 'upcoming-route', 'vessel-to-origin'].forEach((id) => {
        if (mapRef.current?.getLayer(id)) {
          mapRef.current.removeLayer(id);
        }
        if (mapRef.current?.getSource(id)) {
          mapRef.current.removeSource(id);
        }
      });
      return;
    }

    // Clear previous markers and popups
    markersRef.current.forEach(marker => marker.remove());
    popupsRef.current.forEach(popup => popup.remove());
    markersRef.current = [];
    popupsRef.current = [];

    // Try to get tracking data first (new structure)
    const trackingData = getShipmentTrackingForMap(activeShipment);

    let completedPoints: Array<[number, number]> = [];
    let upcomingPoints: Array<[number, number]> = [];

    if (trackingData) {
      // Use new tracking data structure
      completedPoints = trackingData.completedRoute.map((p) => [p.lng, p.lat] as [number, number]);

      // Build upcoming route: from vessel position through remaining route to destination
      upcomingPoints = [];

      // Start from vessel position (closest sea waypoint)
      if (trackingData.currentPosition) {
        upcomingPoints.push([trackingData.currentPosition.lng, trackingData.currentPosition.lat] as [number, number]);
      }

      // Add all remaining route points
      trackingData.remainingRoute.forEach((point) => {
        // Avoid duplicate if first point is same as vessel position
        if (upcomingPoints.length > 0) {
          const lastPoint = upcomingPoints[upcomingPoints.length - 1];
          if (lastPoint) {
            const isDuplicate = Math.abs(lastPoint[0] - point.lng) < 0.0001 &&
              Math.abs(lastPoint[1] - point.lat) < 0.0001;

            if (!isDuplicate) {
              upcomingPoints.push([point.lng, point.lat] as [number, number]);
            }
          }
        } else {
          upcomingPoints.push([point.lng, point.lat] as [number, number]);
        }
      });

      // Ensure it ends at destination port
      if (trackingData.ports.destination && upcomingPoints.length > 0) {
        const lastPoint = upcomingPoints[upcomingPoints.length - 1];
        if (lastPoint) {
          const destinationPoint: [number, number] = [trackingData.ports.destination.lng, trackingData.ports.destination.lat];

          // Only add destination if it's not already the last point
          const isLastPoint = Math.abs(lastPoint[0] - destinationPoint[0]) < 0.0001 &&
            Math.abs(lastPoint[1] - destinationPoint[1]) < 0.0001;

          if (!isLastPoint) {
            upcomingPoints.push(destinationPoint);
          }
        }
      }

      // Fallback: if no remaining route but vessel and destination exist, draw line between them
      if (upcomingPoints.length === 1 && trackingData.ports.destination) {
        upcomingPoints.push([trackingData.ports.destination.lng, trackingData.ports.destination.lat] as [number, number]);
      }
    } else {
      // Fallback to old logic
      const routePoints = getShipmentRouteCoordinates(activeShipment);
      if (routePoints.length < 2) return;

      // Convert to [lng, lat] format for Mapbox
      const points = routePoints.map(({ coords: [lat, lng] }) => [lng, lat] as [number, number]);

      // Determine progress based on status
      let currentMilestoneIndex = -1;
      if (activeShipment.status === 'delivered') {
        currentMilestoneIndex = points.length - 1;
      } else if (activeShipment.status === 'in_transit') {
        currentMilestoneIndex = Math.floor(points.length / 2);
      } else {
        currentMilestoneIndex = 0;
      }

      // Draw route line
      completedPoints = points.slice(0, currentMilestoneIndex + 1);
      upcomingPoints = points.slice(currentMilestoneIndex);
    }

    // Remove existing sources and layers to avoid conflicts
    ['completed-route', 'upcoming-route', 'vessel-to-origin'].forEach((id) => {
      if (mapRef.current?.getLayer(id)) {
        mapRef.current.removeLayer(id);
      }
      if (mapRef.current?.getSource(id)) {
        mapRef.current.removeSource(id);
      }
    });

    // Draw line from vessel to origin if vessel is at origin (on sea, not at port yet)
    if (trackingData) {
      const isAtOrigin = trackingData.completedRoute.length === 0;

      if (isAtOrigin && trackingData.currentPosition && trackingData.ports.origin) {
        // Vessel is at origin (on sea), draw line from vessel to origin port
        const vesselToOriginPath: Array<[number, number]> = [
          [trackingData.currentPosition.lng, trackingData.currentPosition.lat],
          [trackingData.ports.origin.lng, trackingData.ports.origin.lat],
        ];

        // Calculate distance to determine if origin is reached
        const distance = Math.sqrt(
          Math.pow(trackingData.currentPosition.lat - trackingData.ports.origin.lat, 2) +
          Math.pow(trackingData.currentPosition.lng - trackingData.ports.origin.lng, 2)
        );
        const originReached = distance < 0.01; // Very close to origin (approximately 1km)

        mapRef.current?.addSource('vessel-to-origin', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: vesselToOriginPath,
            },
            properties: {},
          },
        });

        mapRef.current?.addLayer({
          id: 'vessel-to-origin',
          type: 'line',
          source: 'vessel-to-origin',
          paint: {
            'line-color': originReached ? '#0A5C3A' : '#94a3b8',
            'line-width': originReached ? 3 : 2,
            'line-opacity': originReached ? 1 : 0.7,
            'line-dasharray': originReached ? [0, 0] : [4, 4],
          },
        });
      }
    }

    // Draw routes with Google Maps–like dotted styling
    if (completedPoints.length > 1) {
      mapRef.current?.addSource('completed-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: completedPoints,
          },
          properties: {},
        },
      });

      mapRef.current?.addLayer({
        id: 'completed-route',
        type: 'line',
        source: 'completed-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#0A5C3A',
          'line-width': 4,
          'line-opacity': 1,
        },
      });
    }

    if (upcomingPoints.length > 1) {
      mapRef.current?.addSource('upcoming-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: upcomingPoints,
          },
          properties: {},
        },
      });

      mapRef.current?.addLayer({
        id: 'upcoming-route',
        type: 'line',
        source: 'upcoming-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#0A5C3A',
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [0.1, 1.6],
        },
      });
    }

    // Add markers - use tracking data if available, otherwise use fallback
    let allPoints: Array<[number, number]> = [];
    if (trackingData) {
      // Add origin, destination, transshipment ports, and current position
      if (trackingData.ports.origin) {
        allPoints.push([trackingData.ports.origin.lng, trackingData.ports.origin.lat]);
      }
      trackingData.ports.transshipment.forEach(port => {
        allPoints.push([port.lng, port.lat]);
      });
      if (trackingData.ports.destination) {
        allPoints.push([trackingData.ports.destination.lng, trackingData.ports.destination.lat]);
      }
      if (trackingData.currentPosition) {
        allPoints.push([trackingData.currentPosition.lng, trackingData.currentPosition.lat]);
      }
    } else {
      // Fallback: use completed and upcoming points
      allPoints = [...completedPoints, ...upcomingPoints];
    }

    allPoints.forEach((point, idx) => {
      const isOrigin = trackingData ? (idx === 0 && trackingData.ports.origin) : idx === 0;
      const isDestination = trackingData ? (idx === allPoints.length - (trackingData.currentPosition ? 2 : 1) && trackingData.ports.destination) : idx === allPoints.length - 1;
      const isTransshipment = trackingData && idx > 0 && idx < allPoints.length - (trackingData.currentPosition ? 2 : 1);
      const isVessel = trackingData && idx === allPoints.length - 1 && trackingData.currentPosition;
      const isCompleted = true; // All markers shown are completed or current
      const isCurrent = isVessel;

      let title = '';
      if (isOrigin) title = `Origin: ${trackingData?.ports.origin?.name || activeShipment.origin}`;
      else if (isDestination) title = `Destination: ${trackingData?.ports.destination?.name || activeShipment.destination}`;
      else if (isTransshipment) {
        const transshipmentIndex = trackingData?.ports.origin ? idx - 1 : idx;
        const transshipmentPort = trackingData?.ports.transshipment[transshipmentIndex];
        title = `Transshipment: ${transshipmentPort?.name || 'T/S Port'}`;
      }
      else if (isVessel) title = `Vessel: ${trackingData?.currentPosition?.vesselName || 'Current Position'}`;
      else title = `Waypoint ${idx}`;

      const fillColor = isVessel ? '#3b82f6' : isTransshipment ? '#f59e0b' : isCompleted ? '#0A5C3A' : '#94a3b8';

      const el = document.createElement('div');
      el.className = 'marker';

      if (isVessel) {
        // Cargo ship image for vessel with transparent white background
        el.style.width = isCurrent ? '40px' : '32px';
        el.style.height = isCurrent ? '40px' : '32px';
        el.style.backgroundColor = 'transparent';
        el.style.border = 'none';
        el.style.cursor = 'pointer';
        el.style.display = 'block';
        el.style.position = 'relative';
        el.style.overflow = 'hidden';

        // Create img element to process white background
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 100;
            canvas.height = img.naturalHeight || 100;
            const context = canvas.getContext('2d');
            if (context && img.naturalWidth && img.naturalHeight) {
              context.drawImage(img, 0, 0);
              const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;

              // Make white pixels transparent
              for (let index = 0; index < data.length; index += 4) {
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                // Check if pixel is white (with tolerance)
                if (r > 240 && g > 240 && b > 240) {
                  data[index + 3] = 0; // Set alpha to 0 (transparent)
                }
              }

              context.putImageData(imageData, 0, 0);
              const transparentImageUrl = canvas.toDataURL('image/png');
              img.src = transparentImageUrl;
            }
          } catch (error) {
            // If processing fails, just use the original image
            console.warn('Failed to process vessel image, using original:', error);
          }
        };
        img.onerror = () => {
          console.error('Failed to load vessel image: /cargo.jpg');
        };
        img.src = '/cargo.jpg';
        el.appendChild(img);
        el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
        el.style.transition = 'all 0.3s ease';
      } else {
        // Regular circular marker for ports
        el.style.width = isCurrent ? '32px' : '24px';
        el.style.height = isCurrent ? '32px' : '24px';
        el.style.backgroundColor = fillColor;
        el.style.borderRadius = '50%';
        el.style.border = '3px solid #0A5C3A';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'white';
        el.style.fontSize = '11px';
        el.style.fontWeight = 'bold';
        el.style.boxShadow = isCurrent ? '0 0 0 8px rgba(10, 92, 58, 0.2)' : 'none';
        el.style.transition = 'all 0.3s ease';

        let label = '';
        if (isOrigin) label = 'O';
        else if (isDestination) label = 'D';
        else if (isTransshipment) label = 'T';
        else label = `${idx}`;

        el.textContent = label;
      }

      // Determine header color and icon based on marker type
      let headerColor = '#0A5C3A';
      let headerGradient = 'linear-gradient(135deg, #0A5C3A 0%, #0d7a4d 100%)';
      let icon = '📍';
      let headerTitle = title;
      let headerSubtitle = '';

      if (isVessel) {
        headerColor = '#3b82f6';
        headerGradient = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        icon = '🚢';
        headerTitle = 'Current Position';
        headerSubtitle = 'Vessel Location';
      } else if (isTransshipment) {
        headerColor = '#f59e0b';
        headerGradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        icon = '🔄';
        headerTitle = 'Transshipment Port';
        headerSubtitle = 'Intermediate Stop';
      } else if (isOrigin) {
        headerTitle = 'Origin Port';
        headerSubtitle = 'Starting Point';
      } else if (isDestination) {
        headerTitle = 'Destination Port';
        headerSubtitle = 'Final Destination';
      }

      let popupContent = `
        <div style="
          width: 360px; 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(${isVessel ? '59, 130, 246' : isTransshipment ? '245, 158, 11' : '10, 92, 58'}, 0.3), 0 0 0 1px rgba(${isVessel ? '59, 130, 246' : isTransshipment ? '245, 158, 11' : '10, 92, 58'}, 0.1);
          overflow: hidden;
          position: relative;
        ">
          <div style="
            background: ${headerGradient};
            padding: 16px 20px;
            color: white;
            display: flex;
            align-items: center;
            gap: 10px;
            position: relative;
          ">
            <div style="
              width: 40px;
              height: 40px;
              background: rgba(255,255,255,0.2);
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
            ">${icon}</div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">${headerTitle}</div>
              ${headerSubtitle ? `<div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">${headerSubtitle}</div>` : ''}
            </div>
          </div>
          <div style="padding: 20px;">
      `;

      if (isVessel && trackingData?.currentPosition) {
        popupContent += `
          <div style="margin-bottom: 16px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <img src="/CargoShip.png" style="width: 100%; height: 200px; object-fit: cover; display: block;" alt="Cargo Ship" />
          </div>
          <div style="
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%);
            border-left: 3px solid #3b82f6;
            padding: 14px 16px;
            border-radius: 8px;
          ">
            <div style="font-size: 12px; color: #666; line-height: 1.8;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="color: #3b82f6; font-weight: 600; min-width: 110px;">Vessel:</span>
                <span style="font-weight: 500;">${trackingData.currentPosition.vesselName || 'N/A'}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="color: #3b82f6; font-weight: 600; min-width: 110px;">IMO:</span>
                <span style="font-family: 'Courier New', monospace; font-weight: 500;">${trackingData.currentPosition.vesselImo || 'N/A'}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #3b82f6; font-weight: 600; min-width: 110px;">Last Updated:</span>
                <span style="font-weight: 500;">${new Date(trackingData.currentPosition.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        `;
      } else if (isTransshipment && trackingData) {
        // Calculate transshipment index: origin is at idx 0, so transshipment ports start at idx 1
        const transshipmentIndex = trackingData.ports.origin ? idx - 1 : idx;
        const transshipmentPort = trackingData.ports.transshipment[transshipmentIndex];
        if (transshipmentPort) {
          popupContent += `
            <div id="transshipment-city-photo-${idx}" style="margin-bottom: 16px; display: none; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <img id="transshipment-city-photo-img-${idx}" style="width: 100%; height: 200px; object-fit: cover; display: block;" alt="City photo" />
            </div>
            <div style="
              background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%);
              border-left: 3px solid #f59e0b;
              padding: 14px 16px;
              border-radius: 8px;
              margin-bottom: 12px;
            ">
              <div style="font-size: 18px; color: #f59e0b; font-weight: 700; margin-bottom: 12px; letter-spacing: 0.2px;">${transshipmentPort.name}</div>
              <div style="font-size: 12px; color: #666; line-height: 1.8;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="color: #f59e0b; font-weight: 600; min-width: 90px;">Port Code:</span>
                  <span>${transshipmentPort.code || 'N/A'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="color: #f59e0b; font-weight: 600; min-width: 90px;">Location:</span>
                  <span>${transshipmentPort.city || ''}${transshipmentPort.city && transshipmentPort.country ? ', ' : ''}${transshipmentPort.country || ''}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="color: #f59e0b; font-weight: 600; min-width: 90px;">Arrival:</span>
                  <span>${new Date(transshipmentPort.arrivalDate).toLocaleDateString()}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #f59e0b; font-weight: 600; min-width: 90px;">Departure:</span>
                  <span>${new Date(transshipmentPort.departureDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          `;
        }
      } else {
        popupContent += `
          <div id="city-photo-${idx}" style="margin-bottom: 16px; display: none; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <img id="city-photo-img-${idx}" style="width: 100%; height: 200px; object-fit: cover; display: block;" alt="City photo" />
          </div>
          <div style="
            background: linear-gradient(135deg, rgba(10, 92, 58, 0.05) 0%, rgba(10, 92, 58, 0.02) 100%);
            border-left: 3px solid #0A5C3A;
            padding: 14px 16px;
            border-radius: 8px;
          ">
            <div style="font-size: 18px; color: #0A5C3A; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.2px;">
              ${isOrigin ? (trackingData?.ports.origin?.name || activeShipment.origin) : ''}
              ${isDestination ? (trackingData?.ports.destination?.name || activeShipment.destination) : ''}
            </div>
            ${isOrigin && trackingData?.ports.origin ? `
              <div style="font-size: 12px; color: #666; line-height: 1.8;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="color: #0A5C3A; font-weight: 600; min-width: 90px;">Port Code:</span>
                  <span>${trackingData.ports.origin.code || 'N/A'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="color: #0A5C3A; font-weight: 600; min-width: 90px;">Country:</span>
                  <span>${trackingData.ports.origin.name.split(',').pop()?.trim() || 'N/A'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #0A5C3A; font-weight: 600; min-width: 90px;">Region:</span>
                  <span>${trackingData.ports.origin.name.split(',').length > 1 ? trackingData.ports.origin.name.split(',').slice(0, -1).join(',').trim() : 'N/A'}</span>
                </div>
              </div>
            ` : ''}
            ${isDestination && trackingData?.ports.destination ? `
              <div style="font-size: 12px; color: #666; line-height: 1.8;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="color: #0A5C3A; font-weight: 600; min-width: 90px;">Port Code:</span>
                  <span>${trackingData.ports.destination.code || 'N/A'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="color: #0A5C3A; font-weight: 600; min-width: 90px;">Country:</span>
                  <span>${trackingData.ports.destination.name.split(',').pop()?.trim() || 'N/A'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="color: #0A5C3A; font-weight: 600; min-width: 90px;">Region:</span>
                  <span>${trackingData.ports.destination.name.split(',').length > 1 ? trackingData.ports.destination.name.split(',').slice(0, -1).join(',').trim() : 'N/A'}</span>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }

      popupContent += `
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: { bottom: [0, -25] },
        maxWidth: '360px',
        className: 'custom-popup',
        closeButton: true,
        closeOnClick: false,
        anchor: 'bottom'
      })
        .setHTML(popupContent);

      // Remove tip/pointer when popup opens
      popup.on('open', () => {
        setTimeout(() => {
          const popupElement = popup.getElement();
          if (popupElement) {
            const tip = popupElement.querySelector('.mapboxgl-popup-tip');
            if (tip) {
              (tip as HTMLElement).style.display = 'none';
              (tip as HTMLElement).style.visibility = 'hidden';
              (tip as HTMLElement).style.opacity = '0';
            }
            // Also remove any background from wrapper
            const wrapper = popupElement.querySelector('.mapboxgl-popup-content-wrapper');
            if (wrapper) {
              (wrapper as HTMLElement).style.background = 'transparent';
              (wrapper as HTMLElement).style.boxShadow = 'none';
            }
          }
        }, 10);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(point)
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
      popupsRef.current.push(popup);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close all other popups first
        popupsRef.current.forEach(p => {
          if (p !== popup && p.isOpen()) {
            p.remove();
          }
        });
        // Open popup first
        if (!popup.isOpen()) {
          popup.addTo(mapRef.current!);
        }
        // Center map with offset to account for popup, so popup appears in center of screen
        setTimeout(() => {
          if (mapRef.current) {
            // Calculate offset to center popup on screen
            const mapContainer = mapRef.current.getContainer();
            const mapHeight = mapContainer.clientHeight;
            // Offset point downward to center popup (popup is above marker, so move marker up)
            // This will make popup appear in center of screen
            const offsetY = mapHeight * 0.2; // Move marker up so popup appears centered

            mapRef.current.flyTo({
              center: [point[0], point[1]],
              zoom: 6,
              duration: 1000,
              offset: [0, offsetY] // Positive offset moves marker down, making popup appear higher (centered)
            });
          }
        }, 100);

        // Fetch and display city photo for origin and destination
        if (isOrigin || isDestination) {
          const cityName = isOrigin ? activeShipment.origin : activeShipment.destination;
          getCityPhoto(cityName).then((photo) => {
            if (photo) {
              const photoContainer = document.getElementById(`city-photo-${idx}`);
              const photoImg = document.getElementById(`city-photo-img-${idx}`) as HTMLImageElement;

              if (photoContainer && photoImg) {
                photoImg.src = photo.url;
                photoImg.alt = photo.altText;
                photoContainer.style.display = 'block';
              }
            }
          }).catch((error) => {
            console.error('Error fetching city photo:', error);
          });
        }

        // Fetch and display city photo for transshipment ports
        if (isTransshipment && trackingData) {
          // Calculate transshipment index: origin is at idx 0, so transshipment ports start at idx 1
          const transshipmentIndex = trackingData.ports.origin ? idx - 1 : idx;
          const transshipmentPort = trackingData.ports.transshipment[transshipmentIndex];
          if (transshipmentPort) {
            // Use city, country format for better photo results
            const locationName = transshipmentPort.city && transshipmentPort.country
              ? `${transshipmentPort.city}, ${transshipmentPort.country}`
              : transshipmentPort.city || transshipmentPort.country || transshipmentPort.name;

            getCityPhoto(locationName).then((photo) => {
              if (photo) {
                const photoContainer = document.getElementById(`transshipment-city-photo-${idx}`);
                const photoImg = document.getElementById(`transshipment-city-photo-img-${idx}`) as HTMLImageElement;

                if (photoContainer && photoImg) {
                  photoImg.src = photo.url;
                  photoImg.alt = photo.altText;
                  photoContainer.style.display = 'block';
                }
              }
            }).catch((error) => {
              console.error('Error fetching transshipment city photo:', error);
            });
          }
        }
      });
    });

    // Fit bounds
    if (allPoints.length > 0) {
      const bounds = allPoints.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds(allPoints[0], allPoints[0])
      );
      mapRef.current?.fitBounds(bounds, { padding: 80 });
    }
  }, [activeShipment]);

  const cycleMapStyle = (): void => {
    const mapStyles: Array<'streets' | 'satellite' | 'satellite-streets' | 'outdoors'> = ['streets', 'satellite', 'satellite-streets', 'outdoors'];
    const currentIndex = mapStyles.indexOf(mapStyle);
    const nextIndex = (currentIndex + 1) % mapStyles.length;
    const nextStyle = mapStyles[nextIndex];
    if (nextStyle) {
      setMapStyle(nextStyle);
    }
  };

  const getMapStyleLabel = (): string => {
    const labels: Record<'streets' | 'satellite' | 'satellite-streets' | 'outdoors', string> = {
      streets: 'Streets',
      satellite: 'Satellite',
      'satellite-streets': 'Sat. Streets',
      outdoors: 'Outdoors',
    };
    return labels[mapStyle];
  };

  const goToShipmentByOffset = (direction: 1 | -1): void => {
    if (!activeShipment || shipments.length === 0) return;

    const currentIndex = shipments.findIndex((s) => s.id === activeShipment.id);
    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + direction + shipments.length) % shipments.length;
    const nextShipment = shipments[nextIndex];

    // Ensure pagination page matches the newly selected shipment
    const newPage = Math.floor(nextIndex / itemsPerPage) + 1;
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }

    setActiveId(nextShipment.id);
    setExpandedId(nextShipment.id);
    onSelect?.(nextShipment);
  };

  const toggleFullscreen = async (): Promise<void> => {
    if (!mapContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await mapContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
        // Trigger map resize after fullscreen transition
        setTimeout(() => {
          mapRef.current?.resize();
        }, 300);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        // Trigger map resize after exiting fullscreen
        setTimeout(() => {
          mapRef.current?.resize();
        }, 300);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleGetCurrentLocation = (): void => {
    if (!mapRef.current) return;

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    const requestLocation = (useHighAccuracy: boolean, hasRetried: boolean) => {
      setIsLocating(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          setUserLocation(location);

          // Center map on user location
          mapRef.current?.flyTo({
            center: [location.lng, location.lat],
            zoom: 15,
          });

          // Remove previous user location marker if exists
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.remove();
          }

          // Create custom marker element
          const el = document.createElement('div');
          el.className = 'user-location-marker';
          el.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="12" fill="#0A5C3A" opacity="0.3"/>
              <circle cx="16" cy="16" r="8" fill="#0A5C3A" opacity="0.5"/>
              <circle cx="16" cy="16" r="4" fill="#0A5C3A"/>
            </svg>
          `;

          // Add marker for user location
          if (mapRef.current) {
            const marker = new mapboxgl.Marker(el)
              .setLngLat([location.lng, location.lat])
              .setPopup(new mapboxgl.Popup().setHTML('<div class="p-2 text-sm font-semibold text-[#0A5C3A]">Your Location</div>'))
              .addTo(mapRef.current);

            userLocationMarkerRef.current = marker;
          }

          setIsLocating(false);
        },
        (error) => {
          if (error.code === error.TIMEOUT && !hasRetried) {
            // Retry once with a more relaxed timeout and without high accuracy
            requestLocation(false, true);
            return;
          }

          setIsLocating(false);
          let errorMessage = 'Unable to get your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          alert(errorMessage);
        },
        {
          enableHighAccuracy: useHighAccuracy,
          timeout: useHighAccuracy ? 15000 : 25000,
          maximumAge: 0,
        }
      );
    };

    // First try high accuracy; on timeout, fallback will retry once
    requestLocation(true, false);
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Trigger map resize
      setTimeout(() => {
        mapRef.current?.resize();
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const getModeIcon = (): React.ReactNode => {
    if (!activeShipment) return null;
    switch (activeShipment.mode) {
      case 'FCL':
      case 'LCL':
        return <Ship className="h-4 w-4" />;
      case 'Air':
        return <Plane className="h-4 w-4" />;
      case 'Road':
        return <Truck className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Map Container */}
      <div className="relative flex-1 overflow-hidden rounded-2xl border-2 border-[#0A5C3A]/20 bg-white shadow-lg min-h-[700px]">
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="rounded-xl bg-white px-4 py-3 text-sm text-red-600 shadow-lg border-2 border-red-200">
              {mapError}
            </div>
          </div>
        )}
        <div ref={mapContainerRef} className="relative h-full w-full">
          {/* Controls container - horizontal layout so buttons sit side-by-side */}
          <div className="pointer-events-none absolute right-4 top-4 z-40 flex gap-2">
            {/* Map Layers Button - Always visible, including in fullscreen */}
            <button
              className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-white border-2 border-[#0A5C3A]/20 shadow-lg hover:border-[#0A5C3A]/40 hover:shadow-xl transition-all group"
              title="Cycle map layers"
              type="button"
              onClick={cycleMapStyle}
            >
              <Layers className="h-5 w-5 text-[#0A5C3A]" />
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {getMapStyleLabel()}
              </div>
            </button>

            {/* Fullscreen/Exit Fullscreen Button - Always visible, including in fullscreen */}
            <button
              className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-white border-2 border-[#0A5C3A]/20 shadow-lg hover:border-[#0A5C3A]/40 hover:shadow-xl transition-all group"
              title={isFullscreen ? "Exit fullscreen" : "Toggle fullscreen"}
              type="button"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5 text-[#0A5C3A]" />
              ) : (
                <Fullscreen className="h-5 w-5 text-[#0A5C3A]" />
              )}
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </div>
            </button>

          </div>
        </div>

        {/* Current Location Button - Bottom Right */}
        <div className="pointer-events-none absolute right-4 bottom-4 z-40">
          <button
            className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-white border-2 border-[#0A5C3A]/20 shadow-lg hover:border-[#0A5C3A]/40 hover:shadow-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            title="Show my location"
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <div className="h-5 w-5 border-2 border-[#0A5C3A] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#0A5C3A]"
              >
                <path
                  d="M44,22H39.9A16.1,16.1,0,0,0,26,8.1h0V4a2,2,0,0,0-4,0V8h0A16.1,16.1,0,0,0,8.1,22H4a2,2,0,0,0,0,4H8.1A16.1,16.1,0,0,0,22,39.9h0v4a2,2,0,0,0,4,0V40h0A16.1,16.1,0,0,0,39.9,26H44a2,2,0,0,0,0-4ZM24,36A12,12,0,1,1,36,24,12,12,0,0,1,24,36Z"
                  fill="currentColor"
                />
                <circle cx="24" cy="24" r="7" fill="currentColor" />
              </svg>
            )}
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {isLocating ? 'Locating...' : 'My Location'}
            </div>
          </button>
        </div>

        {/* Map Overlay Info - Only when a shipment is selected on map */}
        {activeShipment && (
          <div className="pointer-events-none absolute left-4 top-4 z-10">
            <Card className="bg-white backdrop-blur-sm border-2 border-[#0A5C3A]/20 p-4 shadow-lg">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  {activeShipment.orderNumber}
                  <Badge className="bg-[#0A5C3A] text-white border-0">
                    {getStatusLabel(activeShipment.status)}
                  </Badge>
                </div>
                <div className="pointer-events-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goToShipmentByOffset(-1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0A5C3A]/30 bg-white text-[#0A5C3A] shadow-sm hover:border-[#0A5C3A] hover:bg-[#0A5C3A]/5 transition-colors"
                    title="Previous shipment"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToShipmentByOffset(1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0A5C3A]/30 bg-white text-[#0A5C3A] shadow-sm hover:border-[#0A5C3A] hover:bg-[#0A5C3A]/5 transition-colors"
                    title="Next shipment"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <MapPin className="h-3.5 w-3.5 text-[#0A5C3A]" />
                {activeShipment.origin}
                <span className="text-[#0A5C3A]">→</span>
                {activeShipment.destination}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Sidebar with Shipment List - Integrated Details */}
      <div className="w-full rounded-2xl border-2 border-[#0A5C3A]/20 bg-white p-4 shadow-lg lg:w-96 flex flex-col">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0A5C3A]">
          <span className="h-1 w-4 rounded-full bg-[#0A5C3A]" />
          Shipments ({paginatedShipments.length} of {shipments.length})
        </div>
        <div className="space-y-3 overflow-y-auto flex-1 pr-2 pt-1">
          {paginatedShipments.map((shipment, index) => {
            const statusColor = getStatusColor(shipment.status);
            const isExpanded = shipment.id === expandedId;

            return (
              <div key={shipment.id} className="space-y-2">
                {/* Shipment Card */}
                <button
                  onClick={() => {
                    setActiveId(shipment.id);
                    setExpandedId(isExpanded ? null : shipment.id);
                    onSelect?.(shipment);
                  }}
                  className={cn(
                    'w-full rounded-xl border-2 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                    isExpanded
                      ? 'border-[#0A5C3A] bg-[#0A5C3A]/10 shadow-md'
                      : 'border-[#0A5C3A]/20 bg-white hover:border-[#0A5C3A]/40 hover:bg-[#0A5C3A]/5'
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
                    {shipment.orderNumber}
                    <Badge
                      className={`border text-xs ${statusColor?.bg} ${statusColor?.text} ${statusColor?.border} ${statusColor?.hoverBg || ''} ${statusColor?.hoverText || ''}`}
                    >
                      {getStatusLabel(shipment.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <MapPin className="h-3.5 w-3.5 text-[#0A5C3A]" />
                    <span className="truncate">{shipment.origin.split(',')[0]}</span>
                    <span className="text-[#0A5C3A]">→</span>
                    <span className="truncate">{shipment.destination.split(',')[0]}</span>
                  </div>
                </button>

                {/* Expanded Details Panel - Below the shipment card */}
                {isExpanded && (() => {
                  const activeStatusColor = getStatusColor(shipment.status);
                  return (
                    <Card className="rounded-xl border-2 border-[#0A5C3A]/20 bg-[#0A5C3A]/5 shadow-sm">
                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-[#0A5C3A] text-white font-bold text-xs px-2 py-1 border-0">
                                {shipment.orderNumber}
                              </Badge>
                              <Badge className="bg-[#0A5C3A]/10 text-[#0A5C3A] border-[#0A5C3A]/20 px-2 py-0.5 flex items-center gap-1 text-xs">
                                {shipment.mode === 'FCL' || shipment.mode === 'LCL' ? <Ship className="h-3 w-3" /> : shipment.mode === 'Air' ? <Plane className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                                <span>{shipment.mode}</span>
                              </Badge>
                            </div>
                            <Badge
                              className={`border capitalize text-xs ${activeStatusColor?.bg} ${activeStatusColor?.text} ${activeStatusColor?.border} ${activeStatusColor?.hoverBg || ''} ${activeStatusColor?.hoverText || ''}`}
                            >
                              {getStatusLabel(shipment.status)}
                            </Badge>
                          </div>
                        </div>

                        {/* Route Info */}
                        <div className="mb-3 p-2 rounded-lg bg-white border-2 border-[#0A5C3A]/10">
                          <div className="flex items-center gap-2 text-xs text-gray-700 mb-1.5">
                            <MapPin className="h-3 w-3 text-[#0A5C3A]" />
                            <span className="font-medium truncate">{shipment.origin}</span>
                          </div>
                          <div className="h-px bg-gradient-to-r from-transparent via-[#0A5C3A]/30 to-transparent my-1.5" />
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <MapPin className="h-3 w-3 text-[#0A5C3A]" />
                            <span className="font-medium truncate">{shipment.destination}</span>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-gray-600 mb-0.5">Consignee</p>
                              <p className="text-gray-900 font-medium truncate text-xs">{shipment.consignee}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 mb-0.5">Shipper</p>
                              <p className="text-gray-900 font-medium truncate text-xs">{shipment.shipper}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 mb-0.5">BL Number</p>
                              <p className="text-gray-900 font-medium text-xs">{shipment.blNumber}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 mb-0.5">Cust. Ref</p>
                              <p className="text-gray-900 font-medium text-xs">{shipment.customerRefNumber || 'N/A'}</p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#0A5C3A]/10">
                            <div className="flex items-center gap-1.5 text-gray-600 mb-1">
                              <Clock4 className="h-3 w-3 text-[#0A5C3A]" />
                              <span>Created: {formatDate(shipment.createdDate, 'MMM dd')}</span>
                            </div>
                            {shipment.estimatedDelivery && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Clock4 className="h-3 w-3 text-[#0A5C3A]" />
                                <span>Est: {formatDate(shipment.estimatedDelivery, 'MMM dd')}</span>
                              </div>
                            )}
                          </div>

                          {/* Packages/Containers */}
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#0A5C3A]/10">
                            {shipment.containers.length > 0 && (
                              <div className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 border border-[#0A5C3A]/20">
                                <Package className="h-2.5 w-2.5 text-[#0A5C3A]" />
                                <span className="text-xs text-gray-700">{shipment.containers.length}x Container</span>
                              </div>
                            )}
                            {shipment.packages.length > 0 && (
                              <div className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 border border-[#0A5C3A]/20">
                                <Package className="h-2.5 w-2.5 text-[#0A5C3A]" />
                                <span className="text-xs text-gray-700">{shipment.packages.length}x Package</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 pt-4 border-t border-[#0A5C3A]/20">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#0A5C3A]/10 text-[#0A5C3A] hover:bg-[#0A5C3A]/20 border border-[#0A5C3A]/20'
                )}
              >
                Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      'min-w-[2rem] px-2 py-1.5 rounded-lg text-sm font-medium transition-all',
                      currentPage === page
                        ? 'bg-[#0A5C3A] text-white shadow-md'
                        : 'bg-[#0A5C3A]/10 text-[#0A5C3A] hover:bg-[#0A5C3A]/20 border border-[#0A5C3A]/20'
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#0A5C3A]/10 text-[#0A5C3A] hover:bg-[#0A5C3A]/20 border border-[#0A5C3A]/20'
                )}
              >
                Next
              </button>
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
