import { admin, html } from "@/lib/http/handler";
import { DocumentsService } from "@/modules/documents/documents.service";

/** ?version=<versionId> for a frozen version; omit (or "draft") for the live working copy. */
export const GET = admin(async (c) => html(await DocumentsService.srsDocument(c.params.id, c.req.nextUrl.searchParams.get("version"))));
