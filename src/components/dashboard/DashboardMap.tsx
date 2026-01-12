import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fetchShipments } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fullscreen, Minimize2, Search, X } from 'lucide-react';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY || '';

const PORT_COORDS: Record<string, [number, number]> = {
  Singapore: [103.8198, 1.3521],
  Shanghai: [121.4737, 31.2304],
  'Hong Kong': [114.1095, 22.3964],
  Rotterdam: [4.47917, 51.9244],
  Dubai: [55.2708, 25.2048],
  'Los Angeles': [-118.2437, 34.0522],
  Hamburg: [9.9937, 53.5511],
  'New York': [-74.006, 40.7128],
  'Port Klang': [101.4031, 3.0258],
  Busan: [129.0756, 35.1796],
  Tokyo: [139.6917, 35.6895],
  Antwerp: [4.4025, 51.2194],
  Shenzen: [114.0579, 22.5431],
  Xiamen: [118.0894, 24.4798],
  Bangkok: [100.5018, 13.7563],
  Houston: [-95.3698, 29.7604],
  'Long Beach': [-118.1937, 33.7701],
  Kaohsiung: [120.3014, 22.6273],
  'Port Said': [32.2988, 31.2653],
  Ningbo: [121.5505, 29.8746],
};

function createVesselElement(color: string, size = 36) {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.cursor = 'pointer';
  el.style.position = 'relative';

  el.innerHTML = `
    <style>
      @keyframes beacon-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.15); opacity: 0.7; }
      }
      @keyframes beacon-rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes ring-expand {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(2.2); opacity: 0; }
      }
      .beacon-ring {
        position: absolute;
        width: 90%;
        height: 90%;
        border: 1.5px solid ${color};
        border-radius: 50%;
        animation: ring-expand 2s ease-out infinite;
        pointer-events: none;
      }
      .beacon-core {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle, ${color}dd, ${color}88);
        border: 2px solid ${color};
        border-radius: 50%;
        box-shadow: 0 0 10px ${color}99, inset 0 0 8px rgba(255,255,255,0.2);
        animation: beacon-pulse 1.5s ease-in-out infinite;
      }
      .beacon-inner {
        width: 55%;
        height: 55%;
        border-radius: 50%;
        background: ${color};
        box-shadow: 0 0 6px ${color}cc, inset 0 0 4px rgba(255,255,255,0.4);
      }
      .beacon-spinner {
        position: absolute;
        width: 70%;
        height: 70%;
        border-radius: 50%;
        border: 2px solid transparent;
        border-top: 2px solid ${color};
        border-right: 2px solid ${color};
        animation: beacon-rotate 3s linear infinite;
        opacity: 0.6;
      }
    </style>
    <div class="beacon-ring"></div>
    <div class="beacon-core">
      <div class="beacon-spinner"></div>
      <div class="beacon-inner"></div>
    </div>
  `;

  el.style.filter = 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))';
  return el;
}

export function DashboardMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const markerCoordsRef = useRef<Record<string, [number, number]>>({});
  const [shipments, setShipments] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const res = await fetchShipments(1, 1000, {});
        if (canceled) return;
        setShipments(res.data);
      } catch (err) {
        // ignore
      }
    }
    load();
    return () => { canceled = true; };
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!mapboxgl.accessToken) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [30, 20],
      zoom: 2,
    });

    mapRef.current.on('load', () => {
      // subtle atmosphere; do not add default nav controls per request
      // Close selected card and zoom out when clicking on empty map
      mapRef.current?.on('click', () => {
        if (selected) {
          setSelected(null);
          mapRef.current?.flyTo({ center: [30, 20], zoom: 2, duration: 800 });
        }
      });
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      mapRef.current?.remove();
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!mapContainer.current) return;

    try {
      if (!document.fullscreenElement) {
        await mapContainer.current.requestFullscreen();
        setIsFullscreen(true);
        setTimeout(() => mapRef.current?.resize(), 300);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        setTimeout(() => mapRef.current?.resize(), 300);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  useEffect(() => {
    // update markers based on shipments
    if (!mapRef.current) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    markerCoordsRef.current = {};

    shipments.forEach((s) => {
      // derive position from origin/destination or random if unknown
      const port = s.origin || s.destination || 'Singapore';
      const coord = PORT_COORDS[port] || [ (Math.random() * 360 - 180), (Math.random() * 160 - 80) ];

      // Theme-consistent colors based on shipment status
      let color = '#64748b'; // default: slate gray (closed)
      if (s.status === 'in_transit') {
        color = '#0ea5e9'; // bright cyan
      } else if (s.status === 'delivered') {
        color = '#10b981'; // emerald green
      } else if (s.status === 'pending') {
        color = '#f59e0b'; // amber yellow
      }
      
      const el = createVesselElement(color, s.is_pinned ? 44 : 32);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(coord as [number, number])
        .addTo(mapRef.current!);

      // remember coord for search/fly
      markerCoordsRef.current[s.id] = coord as [number, number];

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(s);
        mapRef.current?.flyTo({ center: coord as [number, number], zoom: 5, duration: 900 });
      });

      markersRef.current.push(marker);
    });
  }, [shipments]);

  return (
    <div className="relative">
      <div ref={mapContainer} className="relative h-[720px] w-full rounded-2xl border-2 border-[#0A5C3A]/20 overflow-hidden shadow-lg">

        {/* Expandable Search box (top-left) */}
        <div className="absolute left-6 top-4 z-50">
          <div className="relative">
            {!searchExpanded ? (
              <button
                onClick={() => {
                  setSearchExpanded(true);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/95 text-gray-900 hover:bg-white shadow-lg transition"
              >
                <Search className="h-5 w-5" />
              </button>
            ) : (
              <>
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchTerm(v);
                    // debounce suggestions
                    if (debounceRef.current) window.clearTimeout(debounceRef.current);
                    debounceRef.current = window.setTimeout(() => {
                      const term = v.trim().toLowerCase();
                      if (!term) {
                        setSuggestions([]);
                        return;
                      }
                      const matches = shipments.filter((s) =>
                        String(s.orderNumber || '').toLowerCase().includes(term) ||
                        String(s.id || '').toLowerCase().includes(term)
                      );
                      setSuggestions(matches.slice(0, 8));
                    }, 300);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (suggestions.length > 0) {
                        const found = suggestions[0];
                        const coord = markerCoordsRef.current[found.id];
                        setSelected(found);
                        setSuggestions([]);
                        if (coord) mapRef.current?.flyTo({ center: coord, zoom: 5, duration: 900 });
                      }
                    } else if (e.key === 'Escape') {
                      setSuggestions([]);
                      setSearchExpanded(false);
                      setSearchTerm('');
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      if (!suggestions.length) {
                        setSearchExpanded(false);
                        setSearchTerm('');
                      }
                    }, 200);
                  }}
                  placeholder="Search shipment # or order"
                  className="w-80 rounded-lg border-2 border-white/60 bg-white/95 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white font-medium"
                  autoFocus
                />

                {suggestions.length > 0 && searchExpanded && (
                  <>
                    <style>{`.dashboard-suggestions::-webkit-scrollbar{width:8px;height:8px}.dashboard-suggestions::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.3);border-radius:6px}.dashboard-suggestions{scrollbar-width:thin;}`}</style>
                    <ul className="dashboard-suggestions absolute left-0 top-full mt-2 max-h-56 w-80 overflow-auto rounded-lg bg-white/98 border-2 border-white/80 p-2 text-sm text-gray-900 shadow-2xl">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="cursor-pointer rounded-md px-3 py-2.5 hover:bg-gray-200 transition"
                    onClick={() => {
                      const coord = markerCoordsRef.current[s.id];
                      setSelected(s);
                      setSearchTerm(String(s.orderNumber || s.id));
                      setSuggestions([]);
                      if (coord) mapRef.current?.flyTo({ center: coord, zoom: 5, duration: 800 });
                    }}
                  >
                    <div className="font-bold text-gray-900">{s.orderNumber || s.id}</div>
                    <div className="text-xs text-gray-600">{s.consignee} • {s.origin} → {s.destination}</div>
                  </li>
                ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Fullscreen toggle button (kept inside container so visible in fullscreen) */}
        <button
          aria-label="Toggle fullscreen"
          onClick={toggleFullscreen}
          className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Fullscreen className="h-5 w-5" />}
        </button>

        {selected && (
          <div className="absolute left-6 top-20 w-[360px] z-50">
            <Card className="relative p-4 bg-gradient-to-br from-white/8 to-white/6 backdrop-blur-lg border border-white/10 shadow-2xl">
                <button
                  aria-label="Close"
                  className="absolute right-3 top-3 h-8 w-8 rounded-md flex items-center justify-center bg-white/10 text-white hover:bg-white/20"
                  onClick={() => {
                    setSelected(null);
                    setSearchTerm('');
                    setSuggestions([]);
                    mapRef.current?.flyTo({ center: [30, 20], zoom: 2, duration: 800 });
                  }}
                >
                  ×
                </button>

              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selected.orderNumber}
                    <Badge className="bg-white text-[#0A5C3A] px-3 py-1.5 rounded-full text-xs uppercase min-w-[84px] text-center hover:bg-white/20 transition-colors">{String(selected.status).toUpperCase()}</Badge>
                  </h3>
                </div>
                <div className="mt-1 text-sm text-white/80">{selected.consignee} • {selected.mode}</div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-white/80">
                <div><strong>Origin:</strong> {selected.origin}</div>
                <div><strong>Destination:</strong> {selected.destination}</div>
                <div><strong>Created:</strong> {new Date(selected.createdDate).toLocaleDateString()}</div>
              </div>

              <div className="mt-4 flex gap-2">
                <button className="flex-1 rounded-lg bg-[#0A5C3A] text-white py-2 font-semibold hover:brightness-110">Details</button>
                <button
                  className="rounded-lg bg-white/10 text-white py-2 px-3"
                  onClick={() => {
                    setSelected(null);
                    setSearchTerm('');
                    setSuggestions([]);
                    // zoom out back to overview when closing
                    mapRef.current?.flyTo({ center: [30, 20], zoom: 2, duration: 800 });
                  }}
                >
                  Close
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardMap;
