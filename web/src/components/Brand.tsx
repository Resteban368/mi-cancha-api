/** Icono de la app (esquinas redondeadas del propio archivo). */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/icon-128.png`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      draggable={false}
    />
  );
}

/** Nombre de la marca: «Mi» en verde esmeralda y «Cancha» con el color del texto del tema. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display whitespace-nowrap font-extrabold tracking-tight ${className}`}>
      <span className="text-accent">Mi</span> Cancha
    </span>
  );
}

/** Logo completo con lema; hay una versión para fondo claro y otra para fondo oscuro. */
export function BrandLogo({ className = '' }: { className?: string }) {
  const base = import.meta.env.BASE_URL;
  return (
    <>
      <img
        src={`${base}brand/logo-light.png`}
        alt="Mi Cancha · Tus reservas, al instante"
        className={`brand-on-light ${className}`}
        draggable={false}
      />
      <img src={`${base}brand/logo-dark.png`} alt="" aria-hidden="true" className={`brand-on-dark ${className}`} draggable={false} />
    </>
  );
}
