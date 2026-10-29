import { admin } from "@/lib/http/handler";
import { SrsService } from "@/modules/srs/srs.service";

export const GET = admin(async (c) => ({ data: await SrsService.listVersions(c.params.id) }));
export const POST = admin(async (c) => ({ status: 201, data: await SrsService.createVersion(c.params.id, await c.json().catch(() => ({})), { userId: c.userId, ...c.meta }) }));
