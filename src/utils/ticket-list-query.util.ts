export interface TicketListQuery {
  page: number;
  limit: number;
  skip: number;
}

/** Normaliza query `page`/`limit` de GET /inbox/tickets (padrão 15, máx. 100). */
export function parseTicketListQuery(query: {
  page?: string | number;
  limit?: string | number;
}): TicketListQuery {
  const page = Math.max(parseInt(String(query.page ?? '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? '15'), 10) || 15, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}
