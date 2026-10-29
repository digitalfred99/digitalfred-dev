import { pub } from "@/lib/http/handler";
import { PortalService } from "@/modules/portal/portal.service";

export const POST = pub(async (c) => ({ data: await PortalService.previewSelection(c.params.token, await c.json()) }), { name: "portal-preview", limit: 60 });
