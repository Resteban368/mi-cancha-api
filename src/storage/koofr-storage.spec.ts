import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KoofrStorage } from './koofr-storage.js';

const BASE = 'https://dav.test/Koofr';

function storage(credentials = true) {
  return new KoofrStorage(
    new ConfigService({
      KOOFR_WEBDAV_URL: `${BASE}/`,
      ...(credentials && {
        KOOFR_EMAIL: 'yo@test.co',
        KOOFR_APP_PASSWORD: 'app-pass',
      }),
    }),
  );
}

describe('KoofrStorage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('crea las carpetas que faltan y sube el archivo con Basic auth', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 405 })) // ya existía
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));

    await storage().put('raiz/fotos/a b.png', Buffer.from('x'), 'image/png');

    const calls = fetchMock.mock.calls.map(([url, init]) => [init.method, url]);
    expect(calls).toEqual([
      ['MKCOL', `${BASE}/raiz`],
      ['MKCOL', `${BASE}/raiz/fotos`],
      ['PUT', `${BASE}/raiz/fotos/a%20b.png`],
    ]);
    const { headers } = fetchMock.mock.calls[2][1];
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('yo@test.co:app-pass').toString('base64')}`,
    );
    expect(headers['Content-Type']).toBe('image/png');
  });

  it('get devuelve null si el archivo no existe', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(storage().get('x.png')).resolves.toBeNull();
  });

  it('delete ignora archivos que ya no existen', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(storage().delete('x.png')).resolves.toBeUndefined();
  });

  it('responde 503 si Koofr falla o no hay credenciales', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(storage().get('x.png')).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(storage(false).get('x.png')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
