import { useMemo, useState } from 'react';
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  CrosshairIcon,
  EditIcon,
  ExternalLinkIcon,
  MapPinIcon,
  NavigationIcon,
} from './icons';
import { CityPicker } from './CityPicker';
import { Badge, Button, Card, Field, Input, Modal } from './ui';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../lib/toast';
import type { ClientDetail } from '../lib/types';

interface ClientLocationMapProps {
  client: ClientDetail;
  onChanged: () => void;
}

// Bounding box delta for zoom levels
const ZOOM_DELTAS: Record<number, number> = {
  14: 0.02,
  16: 0.008,
  18: 0.002,
};

export function ClientLocationMap({ client, onChanged }: ClientLocationMapProps) {
  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<14 | 16 | 18>(16);

  const hasCoords =
    typeof client.latitude === 'number' &&
    typeof client.longitude === 'number' &&
    !isNaN(client.latitude) &&
    !isNaN(client.longitude);

  const lat = client.latitude;
  const lng = client.longitude;

  const copyCoords = async () => {
    if (!hasCoords || lat == null || lng == null) return;
    try {
      await navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const delta = ZOOM_DELTAS[zoomLevel];
  const embedUrl = useMemo(() => {
    if (!hasCoords || lat == null || lng == null) return '';
    const minLng = lng - delta;
    const minLat = lat - delta * 0.7;
    const maxLng = lng + delta;
    const maxLat = lat + delta * 0.7;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lng}`;
  }, [hasCoords, lat, lng, delta]);

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${client.address}, ${client.neighborhood}`)}`;

  const wazeUrl = hasCoords
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(`${client.address}, ${client.neighborhood}`)}`;

  const appleMapsUrl = hasCoords
    ? `https://maps.apple.com/?q=${lat},${lng}&ll=${lat},${lng}`
    : `https://maps.apple.com/?q=${encodeURIComponent(`${client.address}, ${client.neighborhood}`)}`;

  return (
    <>
      <Card
        title="Ubicación y Mapa"
        description="Dirección física y georreferenciación GPS para reservas y navegación"
        actions={
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <EditIcon /> Editar ubicación
          </Button>
        }
      >
        <div className="flex flex-col divide-y divide-border">
          {/* Header Info Panel */}
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent-text">
                <MapPinIcon width={22} height={22} />
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-fg">{client.address || 'Sin dirección'}</h3>
                  {client.neighborhood && (
                    <Badge tone="neutral">
                      {client.neighborhood}
                    </Badge>
                  )}
                  {hasCoords ? (
                    <Badge tone="success">
                      GPS Verificado
                    </Badge>
                  ) : (
                    <Badge tone="warn">
                      Sin coordenadas
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-fg-3">
                  {hasCoords
                    ? `Coordenadas: ${lat?.toFixed(6)}, ${lng?.toFixed(6)}`
                    : 'Agrega coordenadas para activar navegación precisa en Google Maps y Waze'}
                </p>
              </div>
            </div>

            {hasCoords && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyCoords}
                  title="Copiar coordenadas"
                  className="gap-1.5"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="text-accent-text" />
                      <span className="text-xs font-medium text-accent-text">Copiado</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon />
                      <span className="text-xs">Copiar coords</span>
                    </>
                  )}
                </Button>

                <div className="h-4 w-px bg-border" />

                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg shadow-2xs hover:bg-surface-2 transition-colors"
                >
                  <ExternalLinkIcon width={14} height={14} />
                  Google Maps
                </a>

                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg shadow-2xs hover:bg-surface-2 transition-colors"
                >
                  <NavigationIcon width={14} height={14} />
                  Waze
                </a>

                <a
                  href={appleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg shadow-2xs hover:bg-surface-2 transition-colors"
                >
                  <ExternalLinkIcon width={14} height={14} />
                  Apple Maps
                </a>
              </div>
            )}
          </div>

          {/* Map Body */}
          <div className="relative overflow-hidden bg-surface-2">
            {hasCoords ? (
              <div className="relative h-72 w-full overflow-hidden sm:h-80">
                <iframe
                  title={`Mapa de ${client.name}`}
                  src={embedUrl}
                  className="h-full w-full border-0 grayscale-[0.1] contrast-[1.02]"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />

                {/* Floating Map Controls overlay */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface/90 p-1 shadow-md backdrop-blur-xs">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => (z === 18 ? 16 : 14))}
                    disabled={zoomLevel === 14}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-fg hover:bg-surface-2 disabled:opacity-40"
                    title="Alejar mapa"
                  >
                    -
                  </button>
                  <span className="px-1 text-[11px] font-mono font-medium text-fg-2">
                    {zoomLevel === 14 ? '1x' : zoomLevel === 16 ? '2x' : '3x'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => (z === 14 ? 16 : 18))}
                    disabled={zoomLevel === 18}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-fg hover:bg-surface-2 disabled:opacity-40"
                    title="Acercar mapa"
                  >
                    +
                  </button>
                  <div className="mx-0.5 h-4 w-px bg-border" />
                  <button
                    type="button"
                    onClick={() => setFullscreen(true)}
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-fg hover:bg-surface-2 cursor-pointer"
                    title="Ver mapa grande"
                  >
                    Ampliar
                  </button>
                </div>

                {/* Pulse pin indicator overlay badge */}
                <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-lg border border-border/80 bg-surface/90 px-2.5 py-1.5 shadow-md backdrop-blur-xs">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                  </span>
                  <span className="text-xs font-medium text-fg">{client.name}</span>
                </div>
              </div>
            ) : (
              /* Empty state placeholder when no coordinates are set */
              <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border bg-surface text-fg-3 shadow-inner">
                  <MapPinIcon width={32} height={32} />
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                    !
                  </span>
                </div>
                <div className="max-w-md">
                  <h4 className="text-sm font-medium text-fg">Ubicación sin georreferenciar</h4>
                  <p className="mt-1 text-xs text-fg-2 leading-relaxed">
                    Este negocio aún no tiene coordenadas GPS configuradas. Asigna las coordenadas
                    para habilitar el mapa interactivo y enlaces directos de navegación para los
                    clientes.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="mt-2"
                >
                  <MapPinIcon /> Fijar en el mapa
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Fullscreen Map Modal */}
      <Modal
        open={fullscreen && hasCoords}
        title={`Ubicación de ${client.name}`}
        description={`${client.address} · ${client.neighborhood}`}
        onClose={() => setFullscreen(false)}
        size="2xl"
      >
        <div className="flex flex-col gap-4">
          <div className="relative h-[65vh] w-full overflow-hidden rounded-xl border border-border bg-surface-2">
            <iframe
              title={`Mapa ampliado de ${client.name}`}
              src={embedUrl}
              className="h-full w-full border-0"
              loading="lazy"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs font-mono text-fg-3">
              Coordenadas GPS: {lat?.toFixed(6)}, {lng?.toFixed(6)}
            </p>
            <div className="flex items-center gap-2">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-2"
              >
                <ExternalLinkIcon width={14} height={14} /> Abrir en Google Maps
              </a>
              <Button variant="secondary" size="sm" onClick={() => setFullscreen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Location Modal */}
      <EditLocationModal
        open={editing}
        client={client}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    </>
  );
}

// Preset major cities in Colombia for quick reference if needed
const COLOMBIA_CITIES = [
  { name: 'Bogotá (Centro)', lat: 4.6097, lng: -74.0817 },
  { name: 'Bogotá (Norte)', lat: 4.6985, lng: -74.0321 },
  { name: 'Medellín (El Poblado)', lat: 6.2088, lng: -75.5684 },
  { name: 'Cali (Granada)', lat: 3.4542, lng: -76.5364 },
  { name: 'Barranquilla', lat: 10.9984, lng: -74.8021 },
  { name: 'Bucaramanga', lat: 7.1254, lng: -73.1198 },
];

interface EditLocationModalProps {
  open: boolean;
  client: ClientDetail;
  onClose: () => void;
  onSaved: () => void;
}

function EditLocationModal({ open, client, onClose, onSaved }: EditLocationModalProps) {
  const toast = useToast();
  const [address, setAddress] = useState(client.address ?? '');
  const [neighborhood, setNeighborhood] = useState(client.neighborhood ?? '');
  const [cityId, setCityId] = useState(client.city?.id ?? '');
  const [latInput, setLatInput] = useState(
    client.latitude != null ? client.latitude.toString() : '',
  );
  const [lngInput, setLngInput] = useState(
    client.longitude != null ? client.longitude.toString() : '',
  );
  const [smartInput, setSmartInput] = useState('');
  const [gettingGps, setGettingGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse parsed numbers
  const parsedLat = parseFloat(latInput);
  const parsedLng = parseFloat(lngInput);
  const hasValidCoords =
    !isNaN(parsedLat) &&
    !isNaN(parsedLng) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180;

  // Smart URL or coordinate parser
  const handleSmartParse = (text: string) => {
    setSmartInput(text);
    const clean = text.trim();
    if (!clean) return;

    // Pattern 1: standard comma separated coords: "4.6789, -74.0567" or "4.6789 -74.0567"
    const pairMatch = clean.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (pairMatch) {
      setLatInput(pairMatch[1]);
      setLngInput(pairMatch[3]);
      setError(null);
      toast('Coordenadas detectadas correctamente', 'success');
      return;
    }

    // Pattern 2: Google Maps URL formats (e.g., @4.6789,-74.0567 or q=4.6789,-74.0567 or ll=4.6789,-74.0567)
    const atMatch = clean.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      setLatInput(atMatch[1]);
      setLngInput(atMatch[2]);
      setError(null);
      toast('Coordenadas extraídas del enlace de Google Maps', 'success');
      return;
    }

    const queryMatch = clean.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (queryMatch) {
      setLatInput(queryMatch[1]);
      setLngInput(queryMatch[2]);
      setError(null);
      toast('Coordenadas extraídas del enlace', 'success');
      return;
    }
  };

  // Get current device geolocation
  const handleGetGps = () => {
    if (!('geolocation' in navigator)) {
      setError('Tu navegador no soporta geolocalización GPS');
      return;
    }
    setGettingGps(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGettingGps(false);
        setLatInput(pos.coords.latitude.toFixed(6));
        setLngInput(pos.coords.longitude.toFixed(6));
        toast('Ubicación GPS obtenida con éxito', 'success');
      },
      (err) => {
        setGettingGps(false);
        setError(`Error al obtener ubicación GPS: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  // Live mini preview embed
  const previewDelta = 0.008;
  const previewEmbedUrl = useMemo(() => {
    if (!hasValidCoords) return '';
    const minLng = parsedLng - previewDelta;
    const minLat = parsedLat - previewDelta * 0.7;
    const maxLng = parsedLng + previewDelta;
    const maxLat = parsedLat + previewDelta * 0.7;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${parsedLat}%2C${parsedLng}`;
  }, [hasValidCoords, parsedLat, parsedLng]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const isRemoving = !latInput.trim() && !lngInput.trim();

    if (!isRemoving && !hasValidCoords) {
      setError('Debes ingresar coordenadas válidas (Latitud: -90 a 90, Longitud: -180 a 180)');
      return;
    }

    setSaving(true);
    try {
      await api<ClientDetail>(`/admin/clients/${client.id}`, {
        method: 'PATCH',
        body: {
          address: address.trim(),
          neighborhood: neighborhood.trim(),
          cityId: cityId || undefined,
          latitude: isRemoving ? null : parsedLat,
          longitude: isRemoving ? null : parsedLng,
        },
      });
      toast('Ubicación actualizada correctamente', 'success');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Editar Ubicación del Negocio"
      description="Actualiza la dirección física y fija las coordenadas en el mapa"
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-xs text-danger">
            <AlertIcon />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <CityPicker cityId={cityId} initial={client.city} onChange={setCityId} />
          <Field label="Dirección física">
            {(id) => (
              <Input
                id={id}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Calle 127 # 14-45"
                required
              />
            )}
          </Field>

          <Field label="Barrio / Sector">
            {(id) => (
              <Input
                id={id}
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ej. Unicentro"
                required
              />
            )}
          </Field>
        </div>

        {/* Smart helper / parser input */}
        <div className="rounded-xl border border-border bg-surface-2/60 p-3.5">
          <label className="block text-xs font-medium text-fg mb-1">
            Pegar coordenadas o link de Google Maps
          </label>
          <div className="flex gap-2">
            <Input
              value={smartInput}
              onChange={(e) => handleSmartParse(e.target.value)}
              placeholder="Pega un enlace de Google Maps o '4.6789, -74.0567'"
              className="text-xs font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGetGps}
              disabled={gettingGps}
              title="Obtener coordenadas desde tu GPS"
              className="shrink-0 gap-1.5"
            >
              <CrosshairIcon width={14} height={14} />
              {gettingGps ? 'Obteniendo...' : 'Mi GPS'}
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-fg-3">
            Detecta automáticamente formatos como: <code>4.7110, -74.0721</code> o URLs de Google
            Maps compartidas.
          </p>
        </div>

        {/* Manual coordinate inputs */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitud GPS" hint="Rango: -90.0000 a 90.0000">
            {(id) => (
              <Input
                id={id}
                type="number"
                step="any"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="4.678912"
                className="font-mono text-xs"
              />
            )}
          </Field>

          <Field label="Longitud GPS" hint="Rango: -180.0000 a 180.0000">
            {(id) => (
              <Input
                id={id}
                type="number"
                step="any"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="-74.056789"
                className="font-mono text-xs"
              />
            )}
          </Field>
        </div>

        {/* Quick city presets */}
        <div>
          <span className="block text-[11px] font-medium text-fg-3 mb-1.5">
            Sedes / ciudades rápidas:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {COLOMBIA_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  setLatInput(c.lat.toFixed(6));
                  setLngInput(c.lng.toFixed(6));
                }}
                className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-fg-2 hover:bg-surface-2 hover:text-fg transition-colors"
              >
                {c.name}
              </button>
            ))}
            {(latInput || lngInput) && (
              <button
                type="button"
                onClick={() => {
                  setLatInput('');
                  setLngInput('');
                  setSmartInput('');
                }}
                className="rounded-md border border-danger/20 bg-danger-soft px-2 py-1 text-[11px] text-danger hover:bg-danger/20 transition-colors"
              >
                Borrar coordenadas
              </button>
            )}
          </div>
        </div>

        {/* Live Preview of Map */}
        {hasValidCoords && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg">Vista previa del marcador:</span>
            <div className="h-44 w-full overflow-hidden rounded-xl border border-border bg-surface-2">
              <iframe
                title="Vista previa mapa"
                src={previewEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar ubicación'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
