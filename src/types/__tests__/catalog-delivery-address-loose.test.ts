import {
  isGeocodableCustomerAddress,
  parseLooseDeliveryAddress,
  textLooksLikeDeliveryAddressInput,
} from '@/types/catalog-delivery-address';
import { parseStreetNumberReply } from '@/utils/catalog-delivery.util';

describe('catalog-delivery-address loose parsing', () => {
  it('endereço completo sem CEP é candidato a geocoding', () => {
    const raw = 'Rua: Salmen Hanze, 1326 Vila Birigui, Rondonópolis MT';
    expect(textLooksLikeDeliveryAddressInput(raw)).toBe(true);
    const parsed = parseLooseDeliveryAddress(raw);
    expect(parsed?.street).toMatch(/Salmen Hanze/i);
    expect(parsed?.number).toBe('1326');
    expect(parsed?.city).toMatch(/Rondonópolis/i);
    expect(parsed?.state).toBe('MT');
    expect(isGeocodableCustomerAddress(raw)).toBe(true);
  });

  it('Rua: Salmen Hanze, 1326 é reconhecido como rua + número', () => {
    expect(parseStreetNumberReply('Rua: Salmen Hanze, 1326')).toEqual({
      street: 'Salmen Hanze',
      number: '1326',
    });
    expect(parseStreetNumberReply('R. Salmen Hanze, nº 1326')).toEqual({
      street: 'Salmen Hanze',
      number: '1326',
    });
    expect(parseStreetNumberReply('Avenida Brasil número 100')).toEqual({
      street: 'Brasil',
      number: '100',
    });
  });

  it('pergunta de taxa não parece endereço', () => {
    expect(textLooksLikeDeliveryAddressInput('mais tem taxa de entrega?')).toBe(false);
  });
});
