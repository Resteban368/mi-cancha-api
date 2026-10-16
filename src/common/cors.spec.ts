import { corsOptions } from './cors.js';

/** Resuelve si el origen recibiría permiso de CORS. */
function allows(
  options: ReturnType<typeof corsOptions>,
  origin: string | undefined,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const check = options.origin as (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => void;
    check(origin, (err, allow) => (err ? reject(err) : resolve(!!allow)));
  });
}

describe('corsOptions', () => {
  it('en producción solo permite los orígenes configurados', async () => {
    const options = corsOptions(
      'https://micancha.co, https://app.micancha.co/',
      'production',
    );
    await expect(allows(options, 'https://micancha.co')).resolves.toBe(true);
    await expect(allows(options, 'https://app.micancha.co')).resolves.toBe(
      true,
    );
    await expect(allows(options, 'https://evil.example')).resolves.toBe(false);
    await expect(allows(options, 'http://localhost:5173')).resolves.toBe(false);
  });

  it('sin orígenes configurados, en producción no permite ningún otro sitio', async () => {
    const options = corsOptions(undefined, 'production');
    await expect(allows(options, 'https://micancha.co')).resolves.toBe(false);
  });

  it('acepta peticiones sin Origin (app móvil, mismo dominio)', async () => {
    await expect(
      allows(corsOptions(undefined, 'production'), undefined),
    ).resolves.toBe(true);
  });

  it('en desarrollo permite cualquier puerto de localhost', async () => {
    const options = corsOptions('', 'development');
    await expect(allows(options, 'http://localhost:51234')).resolves.toBe(true);
    await expect(allows(options, 'http://127.0.0.1:8080')).resolves.toBe(true);
    await expect(allows(options, 'http://localhost.evil.com')).resolves.toBe(
      false,
    );
  });

  it('falla al arrancar si un origen está mal escrito', () => {
    expect(() =>
      corsOptions('https://micancha.co/reservar', 'production'),
    ).toThrow('CORS_ORIGINS tiene orígenes inválidos');
  });
});
