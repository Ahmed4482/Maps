import { useEffect, useMemo, useRef, useState } from 'react';
import { Shipment } from '@/types/shipment';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getStatusColor, getStatusLabel, formatDate } from '@/utils/helpers';
import { MapPin, Package, X, Clock4, Ship, Plane, Truck, Layers, Fullscreen, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getShipmentRouteCoordinates, getShipmentTrackingForMap } from '@/utils/shipmentData';
import { getCityPhoto } from '@/services/unsplash';

// Extract country name from location string
function extractCountry(location: string): string {
  const parts = location.split(',').map(p => p.trim());
  return parts[parts.length - 1] || location;
}

interface MapViewProps {
  shipments: Shipment[];
  selectedShipmentId?: string | null;
  onSelect?: (shipment: Shipment) => void;
}

declare global {
  interface Window {
    google: typeof google;
  }
}

export function MapView({ shipments, selectedShipmentId, onSelect }: MapViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const infoWindowsRef = useRef<google.maps.InfoWindow[]>([]);

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

  // Check if Google Maps is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsGoogleMapsLoaded(true);
        return true;
      }
      return false;
    };

    if (checkGoogleMaps()) return;

    const interval = setInterval(() => {
      if (checkGoogleMaps()) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Initialize Google Map
  useEffect(() => {
    if (!mapContainerRef.current || !isGoogleMapsLoaded || typeof window === 'undefined') return;
    let canceled = false;

    try {
      if (canceled) return;

      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: 24.8607, lng: 67.0011 }, // Karachi center
          zoom: 3,
          mapTypeId: window.google.maps.MapTypeId[mapType.toUpperCase() as keyof typeof window.google.maps.MapTypeId],
          // Disable ALL default Google Maps controls
          fullscreenControl: false,
          zoomControl: false,
          panControl: false,
          mapTypeControl: false,
          scaleControl: false,
          streetViewControl: false,
          rotateControl: false,
          disableDefaultUI: true, // Disable all default UI controls
          styles: mapType === 'roadmap' ? [
            {
              featureType: 'all',
              elementType: 'geometry',
              stylers: [{ color: '#f5f5f5' }],
            },
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#e0e0e0' }],
            },
          ] : [],
        });

        // Close InfoWindows when clicking on the map (but not on markers or InfoWindows)
        let lastInfoWindowOpenTime = 0;

        mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          // Check if click was on InfoWindow
          const target = e.domEvent?.target as HTMLElement;
          if (target) {
            // Don't close if clicking on InfoWindow or its children
            if (target.closest('.gm-style-iw') ||
              target.closest('.gm-style-iw-c') ||
              target.closest('.gm-style-iw-d')) {
              return;
            }
          }

          // Close InfoWindows when clicking directly on map, but only if InfoWindow wasn't just opened
          // Use a longer delay to ensure marker click handlers have time to open InfoWindows
          setTimeout(() => {
            // Double-check that enough time has passed and no InfoWindow was just opened
            const currentTimeSinceOpen = Date.now() - lastInfoWindowOpenTime;
            if (currentTimeSinceOpen > 300) {
              infoWindowsRef.current.forEach((infoWindow) => {
                if (infoWindow) {
                  infoWindow.close();
                }
              });
            }
          }, 150);
        });

        // Store function to track InfoWindow opens
        (mapRef.current as any)._trackInfoWindowOpen = () => {
          lastInfoWindowOpenTime = Date.now();
        };
      } else {
        mapRef.current.setMapTypeId(window.google.maps.MapTypeId[mapType.toUpperCase() as keyof typeof window.google.maps.MapTypeId]);
      }
    } catch (err) {
      console.error('Map initialization error:', err);
      setMapError('Map failed to load. Please check network or reload.');
    }

    return () => {
      canceled = true;
    };
  }, [isGoogleMapsLoaded, mapType]);

  // Style Google Maps InfoWindow close button to match Mapbox design
  useEffect(() => {
    if (!isGoogleMapsLoaded) return;

    const styleId = 'google-maps-infowindow-close-style';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = `
        /* Hide default Google Maps InfoWindow close button */
        .gm-style-iw-c button[aria-label="Close"],
        .gm-style-iw-c button[title="Close"],
        button.gm-ui-hover-effect {
          display: none !important;
          visibility: hidden !important;
        }

        /* Remove default container styling (white background, padding, shadow) */
        .gm-style-iw-c {
          padding: 0 !important;
          background: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }

        /* Remove inner container padding/overflow to allow custom rounded corners and shadows */
        .gm-style-iw-d {
          overflow: visible !important;
          padding: 0 !important; 
          max-height: none !important;
          max-width: none !important;
        }
        
        /* Remove the background shim */
        .gm-style-iw {
          background: none !important;
          box-shadow: none !important;
          z-index: 50 !important;
        }

        /* Hide Google Maps InfoWindow tip/pointer/arrow */
        .gm-style-iw-tc,
        .gm-style-iw-tc::after,
        .gm-style-iw-t::after {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          height: 0 !important;
          border: none !important;
          background: transparent !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
  }, [isGoogleMapsLoaded]);

  // Render route ONLY for active shipment - show ALL 4 milestones
  useEffect(() => {
    if (!mapRef.current || !isGoogleMapsLoaded) return;

    // Clear previous markers and polylines
    markersRef.current.forEach((marker) => marker.setMap(null));
    polylinesRef.current.forEach((polyline) => polyline.setMap(null));
    infoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
    markersRef.current = [];
    polylinesRef.current = [];
    infoWindowsRef.current = [];

    // If no active shipment, just clear everything and return
    if (!activeShipment) return;

    // Try to get tracking data first (new structure)
    const trackingData = getShipmentTrackingForMap(activeShipment);

    if (trackingData) {
      // Use new tracking data structure with completed/remaining routes

      // Draw completed route (bold solid green line)
      if (trackingData.completedRoute.length > 1) {
        const completedLine = new window.google.maps.Polyline({
          path: trackingData.completedRoute,
          geodesic: true,
          strokeColor: '#0A5C3A',
          strokeOpacity: 1.0,
          strokeWeight: 8,
          map: mapRef.current,
        });
        polylinesRef.current.push(completedLine);
      }

      // Draw remaining route (dotted gray line) - from vessel position to destination
      if (trackingData.remainingRoute.length > 0) {
        // Build the path: start from vessel position, then through remaining route, end at destination
        const remainingPath: Array<{ lat: number; lng: number }> = [];

        // Start from vessel position (closest sea waypoint)
        if (trackingData.currentPosition) {
          remainingPath.push({
            lat: trackingData.currentPosition.lat,
            lng: trackingData.currentPosition.lng,
          });
        }

        // Add all remaining route points
        trackingData.remainingRoute.forEach((point) => {
          // Avoid duplicate if first point is same as vessel position
          const isDuplicate = remainingPath.length > 0 &&
            Math.abs(remainingPath[remainingPath.length - 1].lat - point.lat) < 0.0001 &&
            Math.abs(remainingPath[remainingPath.length - 1].lng - point.lng) < 0.0001;

          if (!isDuplicate) {
            remainingPath.push(point);
          }
        });

        // Ensure it ends at destination port
        if (trackingData.ports.destination) {
          const lastPoint = remainingPath[remainingPath.length - 1];
          const destPoint = {
            lat: trackingData.ports.destination.lat,
            lng: trackingData.ports.destination.lng,
          };

          // Only add destination if it's not already the last point
          const isLastPoint = Math.abs(lastPoint.lat - destPoint.lat) < 0.0001 &&
            Math.abs(lastPoint.lng - destPoint.lng) < 0.0001;

          if (!isLastPoint) {
            remainingPath.push(destPoint);
          }
        }

        // Draw the line if we have at least 2 points
        if (remainingPath.length > 1) {
          const remainingLine = new window.google.maps.Polyline({
            path: remainingPath,
            geodesic: true,
            strokeColor: '#94a3b8',
            strokeOpacity: 0.7,
            strokeWeight: 6,
            icons: [
              {
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 3,
                  strokeOpacity: 1,
                  strokeColor: '#94a3b8',
                  fillColor: '#94a3b8',
                  fillOpacity: 0.7,
                },
                offset: '0%',
                repeat: '25px',
              },
            ],
            map: mapRef.current,
          });
          polylinesRef.current.push(remainingLine);
        }
      } else if (trackingData.currentPosition && trackingData.ports.destination) {
        // If no remaining route but vessel and destination exist, draw line between them
        const remainingLine = new window.google.maps.Polyline({
          path: [
            { lat: trackingData.currentPosition.lat, lng: trackingData.currentPosition.lng },
            { lat: trackingData.ports.destination.lat, lng: trackingData.ports.destination.lng },
          ],
          geodesic: true,
          strokeColor: '#94a3b8',
          strokeOpacity: 0.7,
          strokeWeight: 6,
          icons: [
            {
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 3,
                strokeOpacity: 1,
                strokeColor: '#94a3b8',
                fillColor: '#94a3b8',
                fillOpacity: 0.7,
              },
              offset: '0%',
              repeat: '25px',
            },
          ],
          map: mapRef.current,
        });
        polylinesRef.current.push(remainingLine);
      }

      // Draw line from vessel to origin if vessel is at origin (on sea, not at port yet)
      const isAtOrigin = trackingData.completedRoute.length === 0;

      if (isAtOrigin && trackingData.currentPosition && trackingData.ports.origin) {
        // Vessel is at origin (on sea), draw line from vessel to origin port
        // Check if vessel has reached origin by checking if there's a completed route starting from origin
        const vesselToOriginPath = [
          { lat: trackingData.currentPosition.lat, lng: trackingData.currentPosition.lng },
          { lat: trackingData.ports.origin.lat, lng: trackingData.ports.origin.lng },
        ];

        // Calculate distance to determine if origin is reached
        const distance = Math.sqrt(
          Math.pow(trackingData.currentPosition.lat - trackingData.ports.origin.lat, 2) +
          Math.pow(trackingData.currentPosition.lng - trackingData.ports.origin.lng, 2)
        );
        const originReached = distance < 0.01; // Very close to origin (approximately 1km)

        // Use dotted line if origin not reached, bold line if reached
        const originLine = new window.google.maps.Polyline({
          path: vesselToOriginPath,
          geodesic: true,
          strokeColor: originReached ? '#0A5C3A' : '#94a3b8',
          strokeOpacity: originReached ? 1.0 : 0.7,
          strokeWeight: originReached ? 8 : 6,
          icons: originReached ? [] : [
            {
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 3,
                strokeOpacity: 1,
                strokeColor: '#94a3b8',
                fillColor: '#94a3b8',
                fillOpacity: 0.7,
              },
              offset: '0%',
              repeat: '25px',
            },
          ],
          map: mapRef.current,
        });
        polylinesRef.current.push(originLine);
      }

      // Add origin marker
      if (trackingData.ports.origin) {
        const originMarker = new window.google.maps.Marker({
          position: { lat: trackingData.ports.origin.lat, lng: trackingData.ports.origin.lng },
          map: mapRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#0A5C3A',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          label: {
            text: 'O',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 'bold',
          },
          title: `Origin: ${trackingData.ports.origin.name}`,
        });
        markersRef.current.push(originMarker);

        // Origin info window
        const originInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="
              width: 360px; 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%);
              backdrop-filter: blur(20px);
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(10, 92, 58, 0.3), 0 0 0 1px rgba(10, 92, 58, 0.1);
              overflow: hidden;
              margin: -8px 0 0 0;
              position: relative;
            ">
              <div style="
                background: linear-gradient(135deg, #0A5C3A 0%, #0d7a4d 100%);
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
                ">📍</div>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">Origin Port</div>
                  <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">Starting Point</div>
                </div>
                <button onclick="this.closest('.gm-style-iw-d').parentElement.querySelector('button[aria-label=\\'Close\\']')?.click()" style="
                  width: 28px;
                  height: 28px;
                  background: rgba(255,255,255,0.2);
                  border: none;
                  border-radius: 8px;
                  color: white;
                  font-size: 18px;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s;
                  line-height: 1;
                  padding: 0;
                  flex-shrink: 0;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
              </div>
              <div style="padding: 20px;">
                <div id="origin-city-photo" style="margin-bottom: 16px; display: none; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                  <img id="origin-city-photo-img" style="width: 100%; height: 200px; object-fit: cover; display: block;" alt="City photo" />
                </div>
                <div style="
                  background: linear-gradient(135deg, rgba(10, 92, 58, 0.05) 0%, rgba(10, 92, 58, 0.02) 100%);
                  border-left: 3px solid #0A5C3A;
                  padding: 14px 16px;
                  border-radius: 8px;
                  margin-bottom: 16px;
                ">
                  <div style="font-size: 18px; color: #0A5C3A; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.2px;">${trackingData.ports.origin.name}</div>
                  <div style="font-size: 12px; color: #000; line-height: 1.8;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <span style="color: #0A5C3A; font-weight: 700; min-width: 90px;">Port Code:</span>
                      <span style="font-weight: 600;">${trackingData.ports.origin.code || 'N/A'}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <span style="color: #0A5C3A; font-weight: 700; min-width: 90px;">Country:</span>
                      <span style="font-weight: 600;">${trackingData.ports.origin.name.split(',').pop()?.trim() || 'N/A'}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #0A5C3A; font-weight: 700; min-width: 90px;">Region:</span>
                      <span style="font-weight: 600;">${trackingData.ports.origin.name.split(',').length > 1 ? trackingData.ports.origin.name.split(',').slice(0, -1).join(',').trim() : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `,
        });
        originMarker.addListener('click', () => {
          // Track that InfoWindow is being opened
          if ((mapRef.current as any)?._trackInfoWindowOpen) {
            (mapRef.current as any)._trackInfoWindowOpen();
          }
          infoWindowsRef.current.forEach((iw) => iw.close());
          originInfoWindow.open(mapRef.current, originMarker);
          infoWindowsRef.current.push(originInfoWindow);

          // Fetch and display city photo for origin
          getCityPhoto(trackingData.ports.origin.name).then((photo) => {
            if (photo) {
              const photoContainer = document.getElementById('origin-city-photo');
              const photoImg = document.getElementById('origin-city-photo-img') as HTMLImageElement;

              if (photoContainer && photoImg) {
                photoImg.src = photo.url;
                photoImg.alt = photo.altText;
                photoContainer.style.display = 'block';
              }
            }
          }).catch((error) => {
            console.error('Error fetching origin city photo:', error);
          });
        });
      }

      // Add destination marker
      if (trackingData.ports.destination) {
        const destMarker = new window.google.maps.Marker({
          position: { lat: trackingData.ports.destination.lat, lng: trackingData.ports.destination.lng },
          map: mapRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#0A5C3A',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          label: {
            text: 'D',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 'bold',
          },
          title: `Destination: ${trackingData.ports.destination.name}`,
        });
        markersRef.current.push(destMarker);

        // Destination info window
        const destInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="
              width: 360px; 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%);
              backdrop-filter: blur(20px);
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(10, 92, 58, 0.3), 0 0 0 1px rgba(10, 92, 58, 0.1);
              overflow: hidden;
              margin: -8px 0 0 0;
              position: relative;
            ">
              <div style="
                background: linear-gradient(135deg, #0A5C3A 0%, #0d7a4d 100%);
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
                ">🎯</div>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">Destination Port</div>
                  <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">Final Destination</div>
                </div>
                <button onclick="this.closest('.gm-style-iw-d').parentElement.querySelector('button[aria-label=\\'Close\\']')?.click()" style="
                  width: 28px;
                  height: 28px;
                  background: rgba(255,255,255,0.2);
                  border: none;
                  border-radius: 8px;
                  color: white;
                  font-size: 18px;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s;
                  line-height: 1;
                  padding: 0;
                  flex-shrink: 0;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
              </div>
              <div style="padding: 20px;">
                <div id="destination-city-photo" style="margin-bottom: 16px; display: none; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                  <img id="destination-city-photo-img" style="width: 100%; height: 200px; object-fit: cover; display: block;" alt="City photo" />
                </div>
                <div style="
                  background: linear-gradient(135deg, rgba(10, 92, 58, 0.05) 0%, rgba(10, 92, 58, 0.02) 100%);
                  border-left: 3px solid #0A5C3A;
                  padding: 14px 16px;
                  border-radius: 8px;
                  margin-bottom: 16px;
                ">
                  <div style="font-size: 18px; color: #0A5C3A; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.2px;">${trackingData.ports.destination.name}</div>
                  <div style="font-size: 12px; color: #000; line-height: 1.8;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <span style="color: #0A5C3A; font-weight: 700; min-width: 90px;">Port Code:</span>
                      <span style="font-weight: 600;">${trackingData.ports.destination.code || 'N/A'}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <span style="color: #0A5C3A; font-weight: 700; min-width: 90px;">Country:</span>
                      <span style="font-weight: 600;">${trackingData.ports.destination.name.split(',').pop()?.trim() || 'N/A'}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #0A5C3A; font-weight: 700; min-width: 90px;">Region:</span>
                      <span style="font-weight: 600;">${trackingData.ports.destination.name.split(',').length > 1 ? trackingData.ports.destination.name.split(',').slice(0, -1).join(',').trim() : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `,
        });
        destMarker.addListener('click', () => {
          // Track that InfoWindow is being opened
          if ((mapRef.current as any)?._trackInfoWindowOpen) {
            (mapRef.current as any)._trackInfoWindowOpen();
          }
          infoWindowsRef.current.forEach((iw) => iw.close());
          destInfoWindow.open(mapRef.current, destMarker);
          infoWindowsRef.current.push(destInfoWindow);

          // Fetch and display city photo for destination
          getCityPhoto(trackingData.ports.destination.name).then((photo) => {
            if (photo) {
              const photoContainer = document.getElementById('destination-city-photo');
              const photoImg = document.getElementById('destination-city-photo-img') as HTMLImageElement;

              if (photoContainer && photoImg) {
                photoImg.src = photo.url;
                photoImg.alt = photo.altText;
                photoContainer.style.display = 'block';
              }
            }
          }).catch((error) => {
            console.error('Error fetching destination city photo:', error);
          });
        });
      }

      // Add transshipment port markers
      trackingData.ports.transshipment.forEach((port, portIndex) => {
        const transshipmentMarker = new window.google.maps.Marker({
          position: { lat: port.lat, lng: port.lng },
          map: mapRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          label: {
            text: 'T',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 'bold',
          },
          title: `Transshipment: ${port.name}`,
        });
        markersRef.current.push(transshipmentMarker);

        // Transshipment info window
        const transshipmentInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="
              width: 360px; 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%);
              backdrop-filter: blur(20px);
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(245, 158, 11, 0.3), 0 0 0 1px rgba(245, 158, 11, 0.1);
              overflow: hidden;
              margin: -8px 0 0 0;
              position: relative;
            ">
              <div style="
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
                ">🔄</div>
                <div style="flex: 1;">
                  <div style="font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">Transshipment Port</div>
                  <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">Intermediate Stop</div>
                </div>
                <button onclick="this.closest('.gm-style-iw-d').parentElement.querySelector('button[aria-label=\\'Close\\']')?.click()" style="
                  width: 28px;
                  height: 28px;
                  background: rgba(255,255,255,0.2);
                  border: none;
                  border-radius: 8px;
                  color: white;
                  font-size: 18px;
                  font-weight: bold;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s;
                  line-height: 1;
                  padding: 0;
                  flex-shrink: 0;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
              </div>
              <div style="padding: 20px;">
                <div id="transshipment-city-photo-${portIndex}" style="margin-bottom: 16px; display: none; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                  <img id="transshipment-city-photo-img-${portIndex}" style="width: 100%; height: 200px; object-fit: cover; display: block;" alt="City photo" />
                </div>
                <div style="
                  background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%);
                  border-left: 3px solid #f59e0b;
                  padding: 14px 16px;
                  border-radius: 8px;
                  margin-bottom: 12px;
                ">
                  <div style="font-size: 18px; color: #f59e0b; font-weight: 700; margin-bottom: 12px; letter-spacing: 0.2px;">${port.name}</div>
                  <div style="font-size: 12px; color: #000; line-height: 1.8;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <span style="color: #f59e0b; font-weight: 700; min-width: 90px;">Port Code:</span>
                      <span style="font-weight: 600;">${port.code || 'N/A'}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <span style="color: #f59e0b; font-weight: 700; min-width: 90px;">Location:</span>
                      <span style="font-weight: 600;">${port.city || ''}${port.city && port.country ? ', ' : ''}${port.country || ''}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <span style="color: #f59e0b; font-weight: 700; min-width: 90px;">Arrival:</span>
                      <span style="font-weight: 600;">${new Date(port.arrivalDate).toLocaleDateString()}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #f59e0b; font-weight: 700; min-width: 90px;">Departure:</span>
                      <span style="font-weight: 600;">${new Date(port.departureDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `,
        });
        transshipmentMarker.addListener('click', () => {
          // Track that InfoWindow is being opened
          if ((mapRef.current as any)?._trackInfoWindowOpen) {
            (mapRef.current as any)._trackInfoWindowOpen();
          }
          infoWindowsRef.current.forEach((iw) => iw.close());
          transshipmentInfoWindow.open(mapRef.current, transshipmentMarker);
          infoWindowsRef.current.push(transshipmentInfoWindow);

          // Fetch and display city photo for transshipment port
          // Use city, country format for better photo results
          const locationName = port.city && port.country
            ? `${port.city}, ${port.country}`
            : port.city || port.country || port.name;

          getCityPhoto(locationName).then((photo) => {
            if (photo) {
              const photoContainer = document.getElementById(`transshipment-city-photo-${portIndex}`);
              const photoImg = document.getElementById(`transshipment-city-photo-img-${portIndex}`) as HTMLImageElement;

              if (photoContainer && photoImg) {
                photoImg.src = photo.url;
                photoImg.alt = photo.altText;
                photoContainer.style.display = 'block';
              }
            }
          }).catch((error) => {
            console.error('Error fetching transshipment city photo:', error);
          });
        });
      });

      // Add vessel marker at current position
      if (trackingData.currentPosition) {
        // Process cargo.jpg to make white background transparent
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Make white pixels transparent
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              // Check if pixel is white (with some tolerance)
              if (r > 240 && g > 240 && b > 240) {
                data[i + 3] = 0; // Set alpha to 0 (transparent)
              }
            }

            ctx.putImageData(imageData, 0, 0);
            const transparentImageUrl = canvas.toDataURL('image/png');

            const vesselIcon = {
              url: transparentImageUrl,
              scaledSize: new window.google.maps.Size(40, 40),
              anchor: new window.google.maps.Point(20, 20),
            };

            const vesselMarker = new window.google.maps.Marker({
              position: { lat: trackingData.currentPosition.lat, lng: trackingData.currentPosition.lng },
              map: mapRef.current,
              icon: vesselIcon,
              title: `Vessel: ${trackingData.currentPosition.vesselName || 'Unknown'}`,
              zIndex: 1000,
            });
            markersRef.current.push(vesselMarker);

            // Vessel info window
            const vesselInfoWindow = new window.google.maps.InfoWindow({
              content: `
                <div style="
                  width: 360px; 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%);
                  backdrop-filter: blur(20px);
                  border-radius: 16px;
                  box-shadow: 0 20px 60px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.1);
                  overflow: hidden;
                  margin: -8px 0 0 0;
                  position: relative;
                ">
                  <div style="
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
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
                    ">🚢</div>
                    <div style="flex: 1;">
                      <div style="font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">Current Position</div>
                      <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">Vessel Location</div>
                    </div>
                    <button onclick="this.closest('.gm-style-iw-d').parentElement.querySelector('button[aria-label=\\'Close\\']')?.click()" style="
                      width: 28px;
                      height: 28px;
                      background: rgba(255,255,255,0.2);
                      border: none;
                      border-radius: 8px;
                      color: white;
                      font-size: 18px;
                      font-weight: bold;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      transition: all 0.2s;
                      line-height: 1;
                      padding: 0;
                      flex-shrink: 0;
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
                  </div>
                  <div style="padding: 20px;">
                    <div style="margin-bottom: 16px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      <img src="/CargoShip.png" style="width: 100%; height: 200px; object-fit: cover; display: block;" alt="Cargo Ship" />
                    </div>
                    <div style="
                      background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%);
                      border-left: 3px solid #3b82f6;
                      padding: 14px 16px;
                      border-radius: 8px;
                    ">
                      <div style="font-size: 12px; color: #000; line-height: 1.8;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                          <span style="color: #3b82f6; font-weight: 700; min-width: 110px;">Vessel:</span>
                          <span style="font-weight: 600;">${trackingData.currentPosition.vesselName || 'N/A'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                          <span style="color: #3b82f6; font-weight: 700; min-width: 110px;">IMO:</span>
                          <span style="font-family: 'Courier New', monospace; font-weight: 600;">${trackingData.currentPosition.vesselImo || 'N/A'}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="color: #3b82f6; font-weight: 700; min-width: 110px;">Last Updated:</span>
                          <span style="font-weight: 600;">${new Date(trackingData.currentPosition.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `,
            });
            vesselMarker.addListener('click', () => {
              // Track that InfoWindow is being opened
              if ((mapRef.current as any)?._trackInfoWindowOpen) {
                (mapRef.current as any)._trackInfoWindowOpen();
              }
              infoWindowsRef.current.forEach((iw) => iw.close());
              vesselInfoWindow.open(mapRef.current, vesselMarker);
              infoWindowsRef.current.push(vesselInfoWindow);
            });
          }
        };
        img.src = '/cargo.jpg';
      }

      // Fit bounds to show all route points
      const bounds = new window.google.maps.LatLngBounds();
      trackingData.completedRoute.forEach((point) => bounds.extend(point));
      trackingData.remainingRoute.forEach((point) => bounds.extend(point));
      if (trackingData.currentPosition) {
        bounds.extend({ lat: trackingData.currentPosition.lat, lng: trackingData.currentPosition.lng });
      }
      mapRef.current.fitBounds(bounds);

      return;
    }

    // Fallback to old logic if tracking data not available
    const routePoints = getShipmentRouteCoordinates(activeShipment);
    if (routePoints.length < 2) return;

    // Convert to Google Maps format { lat, lng }
    const points = routePoints.map(({ coords: [lat, lng] }) => ({
      lat,
      lng,
    }));

    // For simplified route (origin → country → country → destination), 
    // determine progress based on shipment status
    let currentMilestoneIndex = -1;

    // Check shipment status to determine progress
    if (activeShipment.status === 'delivered') {
      currentMilestoneIndex = points.length - 1; // Fully completed
    } else if (activeShipment.status === 'in_transit') {
      // In transit - show progress up to middle point (between countries)
      currentMilestoneIndex = Math.floor(points.length / 2);
    } else {
      // Pending or other - show at origin
      currentMilestoneIndex = 0;
    }

    // Split route into completed (bold) and upcoming (dotted) segments
    const completedPoints = points.slice(0, currentMilestoneIndex + 1);
    const upcomingPoints = points.slice(currentMilestoneIndex);

    // Draw bold solid line for completed route (up to current milestone)
    if (completedPoints.length > 1) {
      const solidLine = new window.google.maps.Polyline({
        path: completedPoints,
        geodesic: true, // Ensures route goes over sea/ocean
        strokeColor: '#0A5C3A',
        strokeOpacity: 1.0,
        strokeWeight: 8, // Made bold
        map: mapRef.current,
      });
      polylinesRef.current.push(solidLine);
    }

    // Draw dotted line for upcoming route (from current milestone to destination)
    if (upcomingPoints.length > 1) {
      const dashedLine = new window.google.maps.Polyline({
        path: upcomingPoints,
        geodesic: true, // Ensures route goes over sea/ocean
        strokeColor: '#0A5C3A',
        strokeOpacity: 0.6,
        strokeWeight: 6, // Made bold
        icons: [
          {
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 3,
              strokeOpacity: 1,
              strokeColor: '#0A5C3A',
              fillColor: '#0A5C3A',
              fillOpacity: 0.6,
            },
            offset: '0%',
            repeat: '25px',
          },
        ],
        map: mapRef.current,
      });
      polylinesRef.current.push(dashedLine);
    }

    // Add markers for route points: Origin → Coastal → Sea Waypoints → Coastal → Destination
    // Determine point types based on position in route
    const hasOriginCoastal = points.length > 3;
    const hasDestCoastal = points.length > 3;
    const seaWaypointStartIdx = hasOriginCoastal ? 2 : 1;
    const seaWaypointEndIdx = hasDestCoastal ? points.length - 2 : points.length - 1;

    points.forEach((point, idx) => {
      const isOrigin = idx === 0;
      const isDestination = idx === points.length - 1;
      const isOriginCoastal = hasOriginCoastal && idx === 1;
      const isSeaWaypoint = idx >= seaWaypointStartIdx && idx < seaWaypointEndIdx;
      const isDestCoastal = hasDestCoastal && idx === points.length - 2;

      const isCompleted = idx <= currentMilestoneIndex;
      const isCurrent = idx === currentMilestoneIndex;

      // Marker label
      let label = '';
      let title = '';
      if (isOrigin) {
        label = 'O';
        title = `Origin: ${activeShipment.origin}`;
      } else if (isDestination) {
        label = 'D';
        title = `Destination: ${activeShipment.destination}`;
      } else if (isOriginCoastal) {
        label = 'OC';
        title = `Origin Port`;
      } else if (isSeaWaypoint) {
        label = 'S';
        title = `Sea Route`;
      } else if (isDestCoastal) {
        label = 'DC';
        title = `Destination Port`;
      } else {
        label = `${idx}`;
        title = `Waypoint ${idx}`;
      }

      // Marker color based on status
      const fillColor = isCompleted ? '#0A5C3A' : isCurrent ? '#0A5C3A' : '#94a3b8';
      const strokeColor = '#0A5C3A';
      const strokeWeight = isCurrent ? 4 : 3;
      const radius = isOrigin || isDestination ? 12 : 10;

      // Create custom marker icon
      const markerIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: radius * 2,
        fillColor: fillColor,
        fillOpacity: 1,
        strokeColor: strokeColor,
        strokeWeight: strokeWeight,
      };

      const marker = new window.google.maps.Marker({
        position: point,
        map: mapRef.current,
        icon: markerIcon,
        label: {
          text: label,
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 'bold',
        },
        title: title,
      });

      markersRef.current.push(marker);

      // Add pulsing effect for current location (additional circle)
      if (isCurrent) {
        const pulseMarker = new window.google.maps.Circle({
          center: point,
          radius: radius * 2.5 * 1000, // Convert to meters
          fillColor: '#0A5C3A',
          fillOpacity: 0.2,
          strokeColor: '#0A5C3A',
          strokeWeight: 2,
          strokeOpacity: 0.4,
          map: mapRef.current,
        });

        // Animate the pulse circle
        let pulseRadius = radius * 2.5 * 1000;
        const pulseAnimation = setInterval(() => {
          pulseRadius += 500;
          pulseMarker.setRadius(pulseRadius);
          if (pulseRadius > radius * 5 * 1000) {
            pulseRadius = radius * 2.5 * 1000;
          }
        }, 500);

        // Store interval to clear later
        (marker as any).pulseInterval = pulseAnimation;
      }

      // Create info window for marker
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="
            width: 360px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(10, 92, 58, 0.3), 0 0 0 1px rgba(10, 92, 58, 0.1);
            overflow: hidden;
            margin: -8px 0 0 0;
            position: relative;
          ">
            <div style="
              background: linear-gradient(135deg, #0A5C3A 0%, #0d7a4d 100%);
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
              ">📍</div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">${title}</div>
              </div>
              <button onclick="this.closest('.gm-style-iw-d').parentElement.querySelector('button[aria-label=\\'Close\\']')?.click()" style="
                width: 28px;
                height: 28px;
                background: rgba(255,255,255,0.2);
                border: none;
                border-radius: 8px;
                color: white;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                line-height: 1;
                padding: 0;
                flex-shrink: 0;
              " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
            </div>
            <div style="padding: 20px;">
              <div id="city-photo-${idx}" style="margin-bottom: 16px; display: none; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <img id="city-photo-img-${idx}" style="width: 100%; height: 200px; object-fit: cover; display: block;" alt="City photo" />
              </div>
              <div style="
                background: linear-gradient(135deg, rgba(10, 92, 58, 0.05) 0%, rgba(10, 92, 58, 0.02) 100%);
                border-left: 3px solid #0A5C3A;
                padding: 14px 16px;
                border-radius: 8px;
              ">
                ${isOrigin ? `<div style="font-size: 16px; color: #0A5C3A; font-weight: 700; margin-bottom: 4px;">${activeShipment.origin}</div>` : ''}
                ${isDestination ? `<div style="font-size: 16px; color: #0A5C3A; font-weight: 700; margin-bottom: 4px;">${activeShipment.destination}</div>` : ''}
                ${isOriginCoastal ? `<div style="font-size: 14px; color: #000; font-weight: 600; margin-bottom: 4px;">${extractCountry(activeShipment.origin)} Port</div>` : ''}
                ${isSeaWaypoint ? `<div style="font-size: 14px; color: #000; font-weight: 600; margin-bottom: 4px;">Ocean Route</div>` : ''}
                ${isDestCoastal ? `<div style="font-size: 14px; color: #000; font-weight: 600;">${extractCountry(activeShipment.destination)} Port</div>` : ''}
              </div>
            </div>
          </div>
        `,
      });

      infoWindowsRef.current.push(infoWindow);

      marker.addListener('click', () => {
        // Track that InfoWindow is being opened
        if ((mapRef.current as any)?._trackInfoWindowOpen) {
          (mapRef.current as any)._trackInfoWindowOpen();
        }
        // Close all other info windows
        infoWindowsRef.current.forEach((iw) => iw.close());
        infoWindow.open(mapRef.current, marker);

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
      });
    });

    // Fit map to route bounds
    if (points.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds);
    }
  }, [activeShipment, isGoogleMapsLoaded]);

  const cycleMapType = (): void => {
    const mapTypes: Array<'roadmap' | 'satellite' | 'hybrid' | 'terrain'> = ['roadmap', 'satellite', 'hybrid', 'terrain'];
    const currentIndex = mapTypes.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % mapTypes.length;
    const nextType = mapTypes[nextIndex];
    if (nextType) {
      setMapType(nextType);
    }
  };

  const getMapTypeLabel = () => {
    const labels: Record<'roadmap' | 'satellite' | 'hybrid' | 'terrain', string> = {
      roadmap: 'Roadmap',
      satellite: 'Satellite',
      hybrid: 'Hybrid',
      terrain: 'Terrain',
    };
    return labels[mapType];
  };

  const getModeIcon = () => {
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

  const mapWrapperRef = useRef<HTMLDivElement | null>(null);

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
    if (!mapWrapperRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await mapWrapperRef.current.requestFullscreen();
        setIsFullscreen(true);
        // Trigger map resize after fullscreen transition
        setTimeout(() => {
          if (mapRef.current) {
            window.google.maps.event.trigger(mapRef.current, 'resize');
          }
        }, 300);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        // Trigger map resize after exiting fullscreen
        setTimeout(() => {
          if (mapRef.current) {
            window.google.maps.event.trigger(mapRef.current, 'resize');
          }
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

          // Center map on user location with smooth animation
          if (mapRef.current) {
            // Use panTo for smooth panning
            mapRef.current.panTo(location);

            // Smooth zoom animation (similar to Mapbox flyTo)
            const currentZoom = mapRef.current.getZoom() || 3;
            const targetZoom = 15;
            const steps = 20;
            const zoomStep = (targetZoom - currentZoom) / steps;
            let currentStep = 0;

            const zoomInterval = setInterval(() => {
              if (mapRef.current) {
                currentStep++;
                const newZoom = Math.min(currentZoom + (zoomStep * currentStep), targetZoom);
                mapRef.current.setZoom(newZoom);

                if (currentStep >= steps) {
                  clearInterval(zoomInterval);
                  mapRef.current.setZoom(targetZoom);
                }
              } else {
                clearInterval(zoomInterval);
              }
            }, 30);
          }

          // Remove previous user location marker if exists
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.setMap(null);
          }

          // Add marker for user location
          const marker = new window.google.maps.Marker({
            position: location,
            map: mapRef.current,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="12" fill="#0A5C3A" opacity="0.3"/>
                  <circle cx="16" cy="16" r="8" fill="#0A5C3A" opacity="0.5"/>
                  <circle cx="16" cy="16" r="4" fill="#0A5C3A"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(32, 32),
              anchor: new window.google.maps.Point(16, 16),
            },
            title: 'Your Location',
          });

          userLocationMarkerRef.current = marker;

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
        if (mapRef.current) {
          window.google.maps.event.trigger(mapRef.current, 'resize');
        }
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-dismiss Google Maps error message
  useEffect(() => {
    const dismissGoogleMapsError = () => {
      // Find the dismiss button and click it
      const dismissButton = document.querySelector('.dismissButton') as HTMLButtonElement;
      if (dismissButton) {
        dismissButton.click();
      }

      // Also hide the error message container if it exists (multiple selectors for reliability)
      const selectors = [
        'div[style*="background-color: white"][style*="font-family: Roboto"]',
        'div[style*="background-color: white"][style*="google_gray.svg"]',
        'div:has(img[src*="google_gray.svg"])',
      ];

      selectors.forEach(selector => {
        try {
          const errorContainer = document.querySelector(selector);
          if (errorContainer && errorContainer instanceof HTMLElement) {
            errorContainer.style.display = 'none';
            errorContainer.style.visibility = 'hidden';
            errorContainer.style.opacity = '0';
          }
        } catch (e) {
          // Ignore selector errors
        }
      });
    };

    // Try to dismiss immediately
    dismissGoogleMapsError();

    // Set up a MutationObserver to watch for the error message appearing
    const observer = new MutationObserver(() => {
      dismissGoogleMapsError();
    });

    // Observe changes in the document body
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also check periodically as a fallback
    const interval = setInterval(dismissGoogleMapsError, 300);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {/* Hide Google Maps error message with CSS */}
      <style>{`
        .dismissButton,
        div[style*="background-color: white"][style*="font-family: Roboto"],
        div:has(img[src*="google_gray.svg"]) {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
      `}</style>
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Map Container - Larger without fixed details panel */}
        <div ref={mapWrapperRef} className="relative flex-1 overflow-hidden rounded-2xl border-2 border-[#0A5C3A]/20 bg-white shadow-lg min-h-[700px]">
          {!isGoogleMapsLoaded && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-gray-600 shadow-lg border-2 border-[#0A5C3A]/20">
                Loading map...
              </div>
            </div>
          )}
          <div ref={mapContainerRef} className="h-full w-full" style={{ filter: 'brightness(1.3)' }} />
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-red-600 shadow-lg border-2 border-red-200">
                {mapError}
              </div>
            </div>
          )}

          {/* Controls container - horizontal layout so buttons sit side-by-side */}
          <div className="pointer-events-none absolute right-4 top-4 z-40 flex gap-2">
            {/* Map Layers Button - Always visible, including in fullscreen */}
            <button
              className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-white border-2 border-[#0A5C3A]/20 shadow-lg hover:border-[#0A5C3A]/40 hover:shadow-xl transition-all group"
              title="Cycle map layers"
              type="button"
              onClick={cycleMapType}
            >
              <Layers className="h-5 w-5 text-[#0A5C3A]" />
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {getMapTypeLabel()}
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
    </>
  );
}
