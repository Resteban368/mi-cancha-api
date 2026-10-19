import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'onLoad' | 'onError'> & {
  src: string;
  alt: string;
  /** Clases del contenedor (tamaño, forma y bordes redondeados). */
  wrapperClassName?: string;
};

/**
 * Imagen con un shimmer mientras carga. El contenedor toma el tamaño que le des
 * (aspect-ratio, size-*, etc.) y la imagen aparece con un fundido al terminar.
 * Si la imagen no carga, deja un aviso en vez de un hueco.
 */
export function ShimmerImage({ src, alt, className = '', wrapperClassName = '', ...rest }: Props) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const ref = useRef<HTMLImageElement>(null);

  // Una imagen que ya estaba en caché puede estar completa antes de que React escuche el evento.
  useLayoutEffect(() => {
    setState('loading');
    const img = ref.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? 'loaded' : 'error');
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-surface-2 ${state === 'loading' ? 'shimmer' : ''} ${wrapperClassName}`}>
      <img
        ref={ref}
        src={src}
        alt={alt}
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
        className={`size-full transition-opacity duration-300 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'} ${className}`}
        {...rest}
      />
      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-fg-3" role="img" aria-label={alt}>
          <span className="text-2xl" aria-hidden="true">
            🖼️
          </span>
          <span className="text-[11px]">No se pudo cargar</span>
        </div>
      )}
    </div>
  );
}
