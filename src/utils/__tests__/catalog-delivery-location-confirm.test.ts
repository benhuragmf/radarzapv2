import {
  locationAddressNeedsConfirmation,
  mergeLocationConfirmReply,
  parseStreetNumberReply,
  resolveBrazilStateUf,
} from '../catalog-delivery.util';

describe('catalog-delivery location confirm', () => {
  it('pede confirmação quando pin não tem número', () => {
    expect(
      locationAddressNeedsConfirmation({
        reverse: {
          displayName: 'Rua X, Vila Mariana, São Paulo',
          lat: -23.55,
          lon: -46.63,
          road: 'Rua Exemplo',
          suburb: 'Vila Mariana',
          city: 'São Paulo',
          state: 'SP',
          postcode: '04101000',
        },
        addressLabel: 'Rua Exemplo, Vila Mariana, São Paulo',
      }),
    ).toBe(true);
  });

  it('não pede confirmação quando reverse tem número', () => {
    expect(
      locationAddressNeedsConfirmation({
        reverse: {
          displayName: 'Rua X, 100',
          lat: -23.55,
          lon: -46.63,
          houseNumber: '100',
          road: 'Rua Exemplo',
        },
        addressLabel: 'Rua Exemplo, 100',
      }),
    ).toBe(false);
  });

  it('interpreta rua e número na resposta', () => {
    expect(parseStreetNumberReply('Rua das Flores, 123')).toEqual({
      street: 'Rua das Flores',
      number: '123',
    });
    expect(parseStreetNumberReply('Rua: Salmen Hanze, 1326')).toEqual({
      street: 'Salmen Hanze',
      number: '1326',
    });
    expect(parseStreetNumberReply('45')).toEqual({ street: '', number: '45' });
    expect(parseStreetNumberReply('Rua jose pinto, 120')).toEqual({
      street: 'Rua jose pinto',
      number: '120',
    });
    expect(parseStreetNumberReply('Av. jose pinto,120')).toEqual({
      street: 'jose pinto',
      number: '120',
    });
    expect(parseStreetNumberReply('Avenida José Pinto, 1020')).toEqual({
      street: 'José Pinto',
      number: '1020',
    });
    expect(parseStreetNumberReply('José Pinto 120')).toEqual({
      street: 'José Pinto',
      number: '120',
    });
  });

  it('resolve UF a partir do nome do estado', () => {
    expect(resolveBrazilStateUf('Mato Grosso')).toBe('MT');
    expect(resolveBrazilStateUf('State of Mato Grosso')).toBe('MT');
  });

  it('monta endereço com estado por nome completo (pin real)', () => {
    const merged = mergeLocationConfirmReply(
      'Rua jose pinto, 120',
      {
        displayName: 'x',
        lat: -16.47,
        lon: -54.63,
        suburb: 'Centro',
        city: 'Rondonópolis',
        state: 'Mato Grosso',
      },
      { displayAddress: 'Centro, Rondonópolis, Mato Grosso, Brasil' },
    );
    expect(merged).toContain('pinto');
    expect(merged).toContain('120');
    expect(merged).toContain('Rondonópolis');
    expect(merged).toContain('MT');
  });

  it('monta endereço completo com reverse + número', () => {
    const merged = mergeLocationConfirmReply('Rua das Flores, 45', {
      displayName: 'x',
      lat: -23.55,
      lon: -46.63,
      road: 'Rua das Flores',
      suburb: 'Centro',
      city: 'Campo Grande',
      state: 'MS',
      postcode: '79002-000',
    });
    expect(merged).toContain('Rua das Flores');
    expect(merged).toContain('45');
    expect(merged).toContain('Campo Grande');
  });
});
