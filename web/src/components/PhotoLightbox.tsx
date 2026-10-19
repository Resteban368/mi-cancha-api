import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRightIcon, CloseIcon } from './PitchChrome';
import { ShimmerImage } from './ShimmerImage';

export interface LightboxPhoto {
  url: string;
  label: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
/** Zoom al que salta el doble toque. */
const DOUBLE_TAP_SCALE = 2.5;
const BUTTON_STEP = 1.5;

interface View {
  scale: number;
  x: number;
  y: number;
}
const RESET: View = { scale: 1, x: 0, y: 0 };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Foto a pantalla completa con zoom: rueda del mouse, pellizco, doble toque o clic,
 * arrastre para moverse y botones +/−. Con zoom 1 se pasa de foto con deslizar
 * o con las flechas del teclado. Escape cierra solo la foto, no el diálogo de abajo.
 */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];
  const [view, setView] = useState<View>(RESET);
  const viewRef = useRef(view);
  viewRef.current = view;
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  /** Mantiene la imagen dentro del recuadro: no se puede arrastrar más allá de sus bordes. */
  const fit = useCallback((next: View): View => {
    const rect = stage.current?.getBoundingClientRect();
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    if (!rect || scale === MIN_SCALE) return RESET;
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    return { scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);

  /** Cambia el zoom manteniendo fijo el punto (cx, cy), medido desde el centro del recuadro. */
  const zoomAt = useCallback(
    (nextScale: number, cx: number, cy: number, from: View = viewRef.current) => {
      const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const ratio = scale / from.scale;
      setView(fit({ scale, x: cx - (cx - from.x) * ratio, y: cy - (cy - from.y) * ratio }));
    },
    [fit],
  );

  const go = useCallback(
    (step: number) => {
      if (photos.length < 2) return;
      onIndexChange((index + step + photos.length) % photos.length);
    },
    [index, photos.length, onIndexChange],
  );

  // Al cambiar de foto vuelve al zoom normal.
  useLayoutEffect(() => setView(RESET), [index]);

  // Teclado. Escape se atiende en la fase de captura para que no cierre también el diálogo de abajo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === '+' || e.key === '=') zoomAt(viewRef.current.scale * BUTTON_STEP, 0, 0);
      else if (e.key === '-') zoomAt(viewRef.current.scale / BUTTON_STEP, 0, 0);
      else if (e.key === '0') setView(RESET);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, onClose, zoomAt]);

  // Foco en "Cerrar" al abrir y de vuelta al elemento anterior al cerrar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);

  // La rueda necesita un listener no pasivo para evitar que la página se desplace.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAt(
        viewRef.current.scale * factor,
        e.clientX - rect.left - rect.width / 2,
        e.clientY - rect.top - rect.height / 2,
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ---- Gestos con punteros (mouse, dedo, lápiz) ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; view: View } | null>(null);
  const tap = useRef<{ time: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const centerOf = (clientX: number, clientY: number) => {
    const rect = stage.current!.getBoundingClientRect();
    return { cx: clientX - rect.left - rect.width / 2, cy: clientY - rect.top - rect.height / 2 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    stage.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), view: viewRef.current };
      tap.current = null;
    } else {
      tap.current = { time: Date.now(), x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
    }
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const known = pointers.current.get(e.pointerId);
    if (!known) return;
    const dx = e.clientX - known.x;
    const dy = e.clientY - known.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const { cx, cy } = centerOf((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAt(pinch.current.view.scale * (distance / pinch.current.distance), cx, cy, pinch.current.view);
      return;
    }
    if (tap.current && Math.hypot(e.clientX - tap.current.startX, e.clientY - tap.current.startY) > 6) {
      tap.current.moved = true;
    }
    if (viewRef.current.scale > 1) {
      setView((v) => fit({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    // Si queda un dedo tras un pellizco, no cuenta como arrastre nuevo.
    if (pointers.current.size === 0) setDragging(false);
    const t = tap.current;
    tap.current = null;
    if (!t || e.type === 'pointercancel') return;

    // Deslizar con zoom 1: foto anterior o siguiente.
    const dx = e.clientX - t.startX;
    const dy = e.clientY - t.startY;
    if (viewRef.current.scale === 1 && Math.abs(dx) > 60 && Math.abs(dy) < 50) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (t.moved) return;

    // Doble toque o doble clic: acerca o vuelve al tamaño normal.
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.time < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
      lastTap.current = null;
      if (viewRef.current.scale > 1) setView(RESET);
      else {
        const { cx, cy } = centerOf(e.clientX, e.clientY);
        zoomAt(DOUBLE_TAP_SCALE, cx, cy);
      }
    } else {
      lastTap.current = { time: now, x: e.clientX, y: e.clientY };
    }
  };

  if (!photo) return null;
  const zoomed = view.scale > 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ampliada: ${photo.label}`}
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="min-w-0 truncate text-sm font-medium">
          {photo.label}
          {photos.length > 1 && <span className="text-white/60"> · {index + 1} de {photos.length}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <ToolButton label="Alejar" onClick={() => zoomAt(view.scale / BUTTON_STEP, 0, 0)} disabled={!zoomed}>
            <span aria-hidden="true" className="text-lg leading-none">
              −
            </span>
          </ToolButton>
          <button
            type="button"
            onClick={() => setView(RESET)}
            disabled={!zoomed}
            aria-label="Tamaño normal"
            className="tabular min-w-12 rounded-lg px-2 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            {Math.round(view.scale * 100)}%
          </button>
          <ToolButton label="Acercar" onClick={() => zoomAt(view.scale * BUTTON_STEP, 0, 0)} disabled={view.scale >= MAX_SCALE}>
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
          </ToolButton>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Cerrar foto"
            className="ml-1 flex size-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={stage}
          className={`absolute inset-0 touch-none select-none overflow-hidden ${zoomed ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDragStart={(e) => e.preventDefault()}
        >
          <div
            className="flex size-full items-center justify-center"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transition: dragging ? 'none' : 'transform 0.18s ease-out',
            }}
          >
            <ShimmerImage
              key={photo.url}
              src={photo.url}
              alt={photo.label}
              wrapperClassName="size-full bg-transparent"
              className="object-contain"
              draggable={false}
            />
          </div>
        </div>

        {photos.length > 1 && (
          <>
            <NavButton side="left" label="Foto anterior" onClick={() => go(-1)} />
            <NavButton side="right" label="Foto siguiente" onClick={() => go(1)} />
          </>
        )}
      </div>

      <p className="px-4 py-2.5 text-center text-[11px] text-white/50">
        Pellizca, usa la rueda o toca dos veces para acercar · Arrastra para moverte
      </p>
    </div>,
    document.body,
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/10 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function NavButton({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      {side === 'left' ? (
        <ChevronRightIcon className="size-5 rotate-180" strokeWidth={2.5} />
      ) : (
        <ChevronRightIcon className="size-5" strokeWidth={2.5} />
      )}
    </button>
  );
}
