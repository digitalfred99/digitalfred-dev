import { admin } from "@/lib/http/handler";
import { NegotiationsService } from "@/modules/negotiations/negotiations.service";

export const POST = admin(async (c) => ({ data: await NegotiationsService.resolve(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
