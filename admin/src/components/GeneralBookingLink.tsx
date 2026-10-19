import { useToast } from '../lib/toast';
import { useApi } from '../lib/useApi';
import { Button, Card, Skeleton } from './ui';

interface Directory {
  /** Link general de reservas (/reservar), el que ven todos los jugadores. */
  url: string;
}

/** Link general de reservas: el que se comparte para que cada jugador elija su sede. */
export function GeneralBookingLink() {
  const notify = useToast();
  const directory = useApi<Directory>('/public/businesses?limit=1');
  const url = directory.data?.url;

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      notify('Link copiado');
    } catch {
      notify('No se pudo copiar; selecciónalo y cópialo a mano', 'danger');
    }
  }

  return (
    <Card
      title="Link general de reservas"
      description="Compártelo para que los jugadores vean todas las sedes y elijan dónde reservar."
    >
      {directory.loading ? (
        <Skeleton className="h-9 w-full" />
      ) : url ? (
        <div className="flex flex-wrap items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="break-all font-medium text-accent hover:underline">
            {url}
          </a>
          <div className="ml-auto">
            <Button size="sm" onClick={() => copy(url)}>
              Copiar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-fg-2">No se pudo cargar el link general.</p>
      )}
    </Card>
  );
}
