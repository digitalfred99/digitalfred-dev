import { admin } from "@/lib/http/handler";
import { AuditService } from "@/modules/dashboard/audit.service";

export const GET = admin(async (c) => AuditService.list(c.req.nextUrl.searchParams));
