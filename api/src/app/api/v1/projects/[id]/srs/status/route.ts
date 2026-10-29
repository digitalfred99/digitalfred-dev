import { admin } from "@/lib/http/handler";
import { SrsService } from "@/modules/srs/srs.service";

export const PUT = admin(async (c) => ({ data: await SrsService.setStatus(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
