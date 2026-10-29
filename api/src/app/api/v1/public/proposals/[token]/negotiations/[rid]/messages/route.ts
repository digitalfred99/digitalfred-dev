import { pub } from "@/lib/http/handler";
import { PortalService } from "@/modules/portal/portal.service";

export const POST = pub(async (c) => ({ status: 201, data: await PortalService.addMessage(c.params.token, c.params.rid, await c.json(), c.meta) }), { name: "portal-message", limit: 20, windowMs: 600_000 });
