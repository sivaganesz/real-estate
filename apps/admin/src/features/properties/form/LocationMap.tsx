import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export interface LatLng {
  lat: number;
  lng: number;
}

/** India, before an address or pin is known. */
const DEFAULT_VIEW: { center: [number, number]; zoom: number } = {
  center: [20.59, 78.96],
  zoom: 5,
};

/** A map pin drawn with CSS (no image files to bundle). */
const PIN = L.divIcon({
  className: '',
  html: `<svg width="30" height="42" viewBox="0 0 30 42" aria-hidden="true" style="filter:drop-shadow(0 2px 2px rgb(0 0 0 / .35))"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 42 15 42s15-16.1 15-27.2C30 6.6 23.3 0 15 0Z" fill="#ea580c"/><circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

/**
 * Interactive map (OpenStreetMap) for the property location. Click to drop the pin, drag it
 * to adjust. `focus` moves the view (e.g. to the typed address) without moving the pin.
 */
export default function LocationMap({
  pin,
  focus,
  onPin,
}: {
  pin: LatLng | null;
  focus: (LatLng & { zoom?: number; key: string }) | null;
  onPin: (pin: LatLng) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;

  // Create the map once.
  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { ...DEFAULT_VIEW, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) =>
      onPinRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    // Scroll-zoom only after the map is clicked, so the page still scrolls normally.
    m.on('focus', () => m.scrollWheelZoom.enable());
    m.on('blur', () => m.scrollWheelZoom.disable());
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // Keep the marker where the pin is.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!pin) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([pin.lat, pin.lng], {
        icon: PIN,
        draggable: true,
        keyboard: true,
        title: 'Property location',
      })
        .on('dragend', (e) => {
          const at = (e.target as L.Marker).getLatLng();
          onPinRef.current({ lat: at.lat, lng: at.lng });
        })
        .addTo(m);
      m.setView([pin.lat, pin.lng], Math.max(m.getZoom(), 16));
    } else {
      marker.current.setLatLng([pin.lat, pin.lng]);
      if (!m.getBounds().contains([pin.lat, pin.lng])) m.panTo([pin.lat, pin.lng]);
    }
  }, [pin?.lat, pin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show a place (the typed address, or "back to the pin").
  useEffect(() => {
    if (focus && map.current) map.current.setView([focus.lat, focus.lng], focus.zoom ?? 15);
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={box}
      className="h-72 w-full overflow-hidden rounded-lg border [&_.leaflet-container]:font-sans"
      role="application"
      aria-label="Map: click to drop the property pin, drag the pin to adjust"
    />
  );
}
