export type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(raw: { page?: string | null; limit?: string | null }) {
  let page = parseInt(raw.page ?? "", 10);
  let limit = parseInt(raw.limit ?? "", 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export const buildPaginationMeta = (total: number, page: number, limit: number): PaginationMeta => ({
  page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
});
