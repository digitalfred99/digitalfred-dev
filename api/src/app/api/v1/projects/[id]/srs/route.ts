import { admin } from "@/lib/http/handler";
import { SrsService } from "@/modules/srs/srs.service";

export const GET = admin(async (c) => ({ data: await SrsService.getOrCreate(c.params.id, { userId: c.userId, ...c.meta }) }));
export const PUT = admin(async (c) => ({ data: await SrsService.save(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
