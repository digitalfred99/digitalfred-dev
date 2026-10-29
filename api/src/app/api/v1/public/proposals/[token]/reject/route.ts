import { pub } from "@/lib/http/handler";
import { PortalService } from "@/modules/portal/portal.service";

export const POST = pub(async (c) => ({ data: await PortalService.reject(c.params.token, await c.json(), c.meta) }), { name: "portal-reject", limit: 10, windowMs: 600_000 });
