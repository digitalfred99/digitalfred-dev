import { AppDataSource } from "@/database/data-source";
import { AuditLog } from "@/database/entities/AuditLog";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";

export class AuditService {
  static async list(q: URLSearchParams) {
    const { page, limit, skip, take } = parsePagination({ page: q.get("page"), limit: q.get("limit") });
    const qb = (await AppDataSource()).getRepository(AuditLog).createQueryBuilder("a");
    if (q.get("entityType")) qb.andWhere("a.entityType = :t", { t: q.get("entityType") });
    if (q.get("entityId")) qb.andWhere("a.entityId = :i", { i: q.get("entityId") });
    if (q.get("action")) qb.andWhere("a.action LIKE :a", { a: `${q.get("action")}%` });
    if (q.get("actorType")) qb.andWhere("a.actorType = :at", { at: q.get("actorType") });
    const [rows, total] = await qb.orderBy("a.createdAt", "DESC").skip(skip).take(take).getManyAndCount();
    return { data: rows, meta: buildPaginationMeta(total, page, limit) };
  }
}
