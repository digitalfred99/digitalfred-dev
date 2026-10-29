import { admin } from "@/lib/http/handler";
import { NegotiationsService } from "@/modules/negotiations/negotiations.service";

export const GET = admin(async (c) => ({ data: await NegotiationsService.get(c.params.id) }));
