import { admin } from "@/lib/http/handler";
import { SrsService } from "@/modules/srs/srs.service";

export const GET = admin(async (c) => ({ data: await SrsService.getVersion(c.params.id, c.params.vid) }));
