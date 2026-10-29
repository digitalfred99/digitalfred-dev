import type { EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { AuditLog } from "@/database/entities/AuditLog";

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  actorType?: "admin" | "client" | "system";
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const SECRET_KEYS = /pass|token|secret|hash/i;
function scrub(m?: Record<string, unknown>) {
  if (!m) return null;
  return Object.fromEntries(Object.entries(m).filter(([k]) => !SECRET_KEYS.test(k)));
}

/** Pass the transaction's `manager` so the audit row commits or rolls back with the change it describes. */
export async function audit(input: AuditInput, manager?: EntityManager) {
  const em = manager ?? (await AppDataSource()).manager;
  await em.getRepository(AuditLog).insert({
    action: input.action, entityType: input.entityType, entityId: input.entityId ?? null,
    actorUserId: input.actorUserId ?? null, actorType: input.actorType ?? (input.actorUserId ? "admin" : "system"),
    metadata: scrub(input.metadata) as never, ipAddress: input.ipAddress ?? null, userAgent: input.userAgent?.slice(0, 500) ?? null,
  });
}
