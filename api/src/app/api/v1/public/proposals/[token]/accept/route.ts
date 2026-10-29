import { pub } from "@/lib/http/handler";
import { PortalService } from "@/modules/portal/portal.service";

export const POST = pub(async (c) => ({ status: 201, data: await PortalService.accept(c.params.token, await c.json(), c.meta) }), { name: "portal-accept", limit: 10, windowMs: 600_000 });
