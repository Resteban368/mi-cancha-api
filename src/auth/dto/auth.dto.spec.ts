import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterBusinessAdminDto, SignupBusinessDto } from './auth.dto.js';

const base = {
  fullName: 'Andrés Gómez',
  email: 'admin@golazo.co',
  password: 'secreta123',
  businessName: 'Cancha El Golazo',
  address: 'Calle 10 # 5-20',
  neighborhood: 'Centro',
  cityId: '0082c56c-f0f6-4550-aa87-a7e9ea9cdfcf',
};

const erroresDe = async (cls: new () => object, data: object) =>
  (await validate(plainToInstance(cls, data))).map((e) => e.property);

describe('SignupBusinessDto', () => {
  it('exige el celular', async () => {
    expect(await erroresDe(SignupBusinessDto, base)).toContain('phone');
    expect(await erroresDe(SignupBusinessDto, { ...base, phone: '' })).toContain('phone');
  });

  it('acepta el registro con celular', async () => {
    expect(await erroresDe(SignupBusinessDto, { ...base, phone: '+57 300 123 4567' })).toEqual([]);
  });

  it('no cambia el registro de administrador, donde el celular sigue siendo opcional', async () => {
    const { fullName, email, password } = base;
    expect(await erroresDe(RegisterBusinessAdminDto, { fullName, email, password })).toEqual([]);
  });
});
