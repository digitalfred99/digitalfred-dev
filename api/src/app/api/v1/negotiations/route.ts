import { admin } from "@/lib/http/handler";
import { NegotiationsService } from "@/modules/negotiations/negotiations.service";

export const GET = admin(async (c) => NegotiationsService.list(c.req.nextUrl.searchParams));
