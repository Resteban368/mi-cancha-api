import { useRef, useState, type ChangeEvent } from 'react';
import { CameraIcon, TrashIcon } from './icons';
import { api, errorMessage } from '../lib/api';
import { useToast } from '../lib/toast';
import type { ClientDetail } from '../lib/types';

interface ClientPhotosProps {
  client: ClientDetail;
  onChanged: () => void;
}

const MAX_PHOTOS = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

/** Fotos del negocio (hasta 5). La primera es la portada que sale en el directorio. */
export function ClientCover({ client, onChanged }: ClientPhotosProps) {
  const { id: clientId, name } = client;
  const photos = client.photos ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const toast = useToast();
  const current = photos[Math.min(selected, photos.length - 1)];

  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast(success, 'success');
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast('La imagen no puede pesar más de 4 MB', 'danger');
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast('Formato de imagen inválido. Usa JPG o PNG', 'danger');
      return;
    }
    const formData = new FormData();
    formData.append('image', file);
    await run(
      async () => {
        await api(`/admin/clients/${clientId}/photos`, { method: 'POST', body: formData });
        setSelected(photos.length);
      },
      'Foto agregada',
    );
  }

  function remove(photoId: string) {
    if (!window.confirm(`¿Seguro que deseas eliminar esta foto de "${name}"?`)) return;
    setSelected(0);
    void run(() => api(`/admin/clients/${clientId}/photos/${photoId}`, { method: 'DELETE' }), 'Foto eliminada');
  }

  function move(from: number, to: number) {
    const ids = photos.map((p) => p.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setSelected(to);
    void run(
      () => api(`/admin/clients/${clientId}/photos/order`, { method: 'PUT', body: { ids } }),
      to === 0 ? 'Portada actualizada' : 'Orden actualizado',
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFile}
        className="hidden"
        aria-label={`Subir foto de ${name}`}
      />

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-surface-2">
        {current ? (
          <img src={current.url} alt={`Foto de ${name}`} className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-border/80 p-4 text-center transition-colors hover:border-accent hover:bg-accent/5"
          >
            <CameraIcon width={20} height={20} className="text-fg-3" />
            <span className="text-xs font-medium text-fg">Agregar fotos del negocio</span>
            <span className="text-[10px] text-fg-3">JPG o PNG, máx. 4 MB · hasta {MAX_PHOTOS}</span>
          </button>
        )}
        {current && selected === 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
            Portada
          </span>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fotos del negocio">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
                aria-label={`Ver foto ${i + 1}${i === 0 ? ' (portada)' : ''}`}
                className={`size-12 overflow-hidden rounded-lg border-2 ${i === selected ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'}`}
              >
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                aria-label="Agregar foto"
                className="flex size-12 items-center justify-center rounded-lg border-2 border-dashed border-border text-lg text-fg-3 hover:border-accent hover:text-accent-text"
              >
                +
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              disabled={busy || selected === 0}
              onClick={() => move(selected, 0)}
              className="rounded-lg border border-border px-2 py-1 font-medium hover:bg-surface-2 disabled:opacity-40"
            >
              Hacer portada
            </button>
            <button
              type="button"
              disabled={busy || selected === 0}
              onClick={() => move(selected, selected - 1)}
              aria-label="Mover antes"
              className="rounded-lg border border-border px-2 py-1 hover:bg-surface-2 disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              disabled={busy || selected >= photos.length - 1}
              onClick={() => move(selected, selected + 1)}
              aria-label="Mover después"
              className="rounded-lg border border-border px-2 py-1 hover:bg-surface-2 disabled:opacity-40"
            >
              →
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => current && remove(current.id)}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-danger hover:bg-danger-soft disabled:opacity-40"
            >
              <TrashIcon width={13} height={13} />
              Eliminar
            </button>
          </div>
          <p className="text-[10px] text-fg-3">
            {photos.length} de {MAX_PHOTOS} fotos · la primera es la portada del directorio
          </p>
        </>
      )}
    </div>
  );
}
