import { parseTicketListQuery } from '@/utils/ticket-list-query.util';

describe('parseTicketListQuery', () => {
  it('usa padrão page=1 limit=15', () => {
    expect(parseTicketListQuery({})).toEqual({ page: 1, limit: 15, skip: 0 });
  });

  it('calcula skip para página 2', () => {
    expect(parseTicketListQuery({ page: '2', limit: '15' })).toEqual({
      page: 2,
      limit: 15,
      skip: 15,
    });
  });

  it('limita máximo em 100', () => {
    expect(parseTicketListQuery({ limit: '500' }).limit).toBe(100);
  });

  it('normaliza page inválida para 1', () => {
    expect(parseTicketListQuery({ page: '0' }).page).toBe(1);
    expect(parseTicketListQuery({ page: 'abc' }).page).toBe(1);
  });

  it('limit 0 ou inválido usa padrão 15', () => {
    expect(parseTicketListQuery({ limit: '0' }).limit).toBe(15);
    expect(parseTicketListQuery({ limit: 'abc' }).limit).toBe(15);
  });
});
