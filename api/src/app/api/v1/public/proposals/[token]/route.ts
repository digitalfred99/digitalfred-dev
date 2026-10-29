import { pub } from "@/lib/http/handler";
import { PortalService } from "@/modules/portal/portal.service";

export const GET = pub(async (c) => ({ data: await PortalService.view(c.params.token, c.meta) }), { name: "portal-view", limit: 60 });
