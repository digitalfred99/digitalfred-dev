import { admin, html } from "@/lib/http/handler";
import { DocumentsService } from "@/modules/documents/documents.service";

export const GET = admin(async (c) => html(await DocumentsService.changeRequestDocument(c.params.id)));
