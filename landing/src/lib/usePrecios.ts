import { useEffect, useState } from 'react';
import { precioVentasInicial, preciosIniciales } from '../precios';
import { fetchPrecioVentas, fetchPrecios } from './api';

/** Precio mensual por canchas (posición 0 = 1 cancha): los del build hasta que responda la API. */
export function usePrecios(): number[] {
  const [precios, setPrecios] = useState(preciosIniciales);

  useEffect(() => {
    let vigente = true;
    fetchPrecios()
      .then((actuales) => {
        if (vigente) setPrecios(actuales);
      })
      .catch(() => {
        // Sin API se quedan los del build.
      });
    return () => {
      vigente = false;
    };
  }, []);

  return precios;
}

/** Precio mensual del módulo Ventas e inventario; 0 si aún no tiene. */
export function usePrecioVentas(): number {
  const [precio, setPrecio] = useState(precioVentasInicial);

  useEffect(() => {
    let vigente = true;
    fetchPrecioVentas()
      .then((actual) => {
        if (vigente) setPrecio(actual);
      })
      .catch(() => {
        // Sin API se queda el del build.
      });
    return () => {
      vigente = false;
    };
  }, []);

  return precio;
}
