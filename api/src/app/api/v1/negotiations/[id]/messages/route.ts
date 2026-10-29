import { admin } from "@/lib/http/handler";
import { NegotiationsService } from "@/modules/negotiations/negotiations.service";

export const POST = admin(async (c) => ({ status: 201, data: await NegotiationsService.addMessage(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
