import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS, radiusLabel, type SavedLocation } from '../lib/location';
import type { DirectoryMapPoint } from '../lib/types';
import { Button, Dialog } from './ui';

const COLOMBIA_CENTER: L.LatLngTuple = [4.6, -74.1];

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

const venueIcon = L.divIcon({
  className: '',
  html: '<span class="map-venue"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
const meIcon = L.divIcon({
  className: '',
  html: '<span class="map-me"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/**
 * «¿Desde dónde buscas?»: el jugador marca su ubicación en el mapa (o usa el GPS), ve todas las
 * sedes y elige el radio. Se abre solo la primera vez que entra a Explorar con sesión.
 */
export default function LocationDialog({
  open,
  current,
  onConfirm,
  onClear,
  onClose,
}: {
  open: boolean;
  current: SavedLocation | null;
  onConfirm: (location: SavedLocation) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const me = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(current && { lat: current.lat, lng: current.lng });
  const [radiusKm, setRadiusKm] = useState<number | null>(current ? current.radiusKm : DEFAULT_RADIUS_KM);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string>();
  const [venues, setVenues] = useState<DirectoryMapPoint[]>([]);

  useEffect(() => {
    if (!open) return;
    api<DirectoryMapPoint[]>('/public/businesses/map').then(setVenues, () => setVenues([]));
  }, [open]);

  // Crea el mapa una sola vez por apertura.
  useEffect(() => {
    if (!open || !mapEl.current) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const instance = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView(
      current ? [current.lat, current.lng] : COLOMBIA_CENTER,
      current ? 12 : 6,
    );
    L.tileLayer(dark ? TILES.dark : TILES.light, {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(instance);
    instance.on('click', (e: L.LeafletMouseEvent) => setPoint({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = instance;
    // El diálogo se anima al abrir: Leaflet necesita recalcular su tamaño.
    const timer = setTimeout(() => instance.invalidateSize(), 150);
    return () => {
      clearTimeout(timer);
      instance.remove();
      map.current = null;
      me.current = null;
      circle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Marcadores de todas las sedes; si no hay ubicación previa, el mapa las encuadra.
  useEffect(() => {
    const instance = map.current;
    if (!instance || venues.length === 0) return;
    const layer = L.layerGroup().addTo(instance);
    for (const v of venues) {
      L.marker([v.latitude, v.longitude], { icon: venueIcon, interactive: true, keyboard: false })
        .bindTooltip(v.name, { direction: 'top', offset: [0, -8] })
        .addTo(layer);
    }
    if (!current) {
      instance.fitBounds(L.latLngBounds(venues.map((v) => [v.latitude, v.longitude] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 13 });
    }
    return () => {
      layer.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, open]);

  // Marcador del jugador (se puede arrastrar) y círculo del radio.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !point) return;
    if (!me.current) {
      me.current = L.marker([point.lat, point.lng], { icon: meIcon, draggable: true, zIndexOffset: 1000 }).addTo(instance);
      me.current.on('dragend', () => {
        const at = me.current!.getLatLng();
        setPoint({ lat: at.lat, lng: at.lng });
      });
    } else {
      me.current.setLatLng([point.lat, point.lng]);
    }
    circle.current?.remove();
    circle.current = null;
    if (radiusKm !== null) {
      circle.current = L.circle([point.lat, point.lng], {
        radius: radiusKm * 1000,
        color: '#00c853',
        weight: 2,
        fillColor: '#00c853',
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(instance);
    }
  }, [point, radiusKm, open]);

  function locateMe() {
    if (!navigator.geolocation) {
      setMessage('Tu navegador no permite usar la ubicación. Toca el mapa para marcarla.');
      return;
    }
    setLocating(true);
    setMessage(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setPoint(next);
        map.current?.flyTo([next.lat, next.lng], 13);
      },
      () => {
        setLocating(false);
        setMessage('No pudimos usar tu ubicación. Revisa el permiso del navegador o toca el mapa para marcarla.');
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="location-title" wide>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="location-title" className="text-xl font-bold">
            ¿Desde dónde buscas?
          </h2>
          <p className="mt-1 text-sm text-fg-2">
            Marca tu ubicación y te mostramos primero las sedes más cercanas. Los puntos verdes son las sedes.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl text-fg-3 hover:bg-hover"
        >
          ×
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={locateMe} loading={locating}>
          Usar mi ubicación actual
        </Button>
        <span className="text-xs text-fg-3">o toca el mapa (puedes arrastrar el punto)</span>
      </div>
      {message && <p className="mt-2 text-xs text-warn">{message}</p>}

      <div
        ref={mapEl}
        role="application"
        aria-label="Mapa de sedes: toca para marcar tu ubicación"
        className="mt-3 h-64 w-full overflow-hidden rounded-2xl border border-hairline bg-surface-2 sm:h-80"
      />
      <p className="mt-2 text-xs text-fg-3" aria-live="polite">
        {point ? `Ubicación marcada. ${venues.length} sedes en el mapa.` : `Aún no marcas tu ubicación. ${venues.length} sedes en el mapa.`}
      </p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-3">Mostrar sedes a</p>
        <div role="group" aria-label="Radio de búsqueda" className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((km) => (
            <button
              key={String(km)}
              type="button"
              aria-pressed={radiusKm === km}
              onClick={() => setRadiusKm(km)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                radiusKm === km ? 'border-transparent bg-accent text-accent-fg' : 'border-hairline bg-surface text-fg-2 hover:border-fg-3'
              }`}
            >
              {km === null ? 'Todas (por cercanía)' : `${radiusLabel(km)} o menos`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Ahora no
          </Button>
          {current && (
            <Button variant="secondary" onClick={onClear}>
              Quitar ubicación
            </Button>
          )}
        </div>
        <Button disabled={!point} onClick={() => point && onConfirm({ ...point, radiusKm })}>
          Buscar cerca de aquí
        </Button>
      </div>
    </Dialog>
  );
}
