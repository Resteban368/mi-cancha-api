import type { Request } from 'express';

/** IP del cliente: en Vercel llega en x-forwarded-for (la primera es la del cliente). */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim();
  return first || req.ip || null;
}
