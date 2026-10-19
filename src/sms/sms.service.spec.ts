import { ServiceUnavailableException } from '@nestjs/common';
import { TwilioSmsService } from './sms.service.js';

const config = {
  accountSid: `AC${'0'.repeat(32)}`,
  authToken: 'token',
  from: '+15005550006',
};

describe('TwilioSmsService', () => {
  it('envía con el SDK desde el número configurado', async () => {
    const create = vi.fn().mockResolvedValue({ sid: 'SM1' });
    const client = { messages: { create } } as never;
    await new TwilioSmsService(config, client).send('+573001234567', 'Hola');
    expect(create).toHaveBeenCalledWith({
      to: '+573001234567',
      body: 'Hola',
      from: '+15005550006',
    });
  });

  it('con un Messaging Service usa messagingServiceSid', async () => {
    const create = vi.fn().mockResolvedValue({ sid: 'SM1' });
    const from = `MG${'a'.repeat(32)}`;
    await new TwilioSmsService({ ...config, from }, {
      messages: { create },
    } as never).send('+573001234567', 'Hola');
    expect(create.mock.calls[0][0]).toMatchObject({
      messagingServiceSid: from,
    });
  });

  it('si Twilio falla responde 503 sin exponer el detalle', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('x'), { code: 21608, status: 400 }),
      );
    await expect(
      new TwilioSmsService(config, { messages: { create } } as never).send(
        '+573001234567',
        'Hola',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('acepta API Key en lugar del Auth Token', () => {
    const service = new TwilioSmsService({
      accountSid: config.accountSid,
      apiKey: { sid: `SK${'1'.repeat(32)}`, secret: 'secreto' },
      from: config.from,
    });
    expect(service).toBeInstanceOf(TwilioSmsService);
  });
});
