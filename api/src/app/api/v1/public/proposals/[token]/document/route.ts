import { pub, html } from "@/lib/http/handler";
import { badRequest } from "@/lib/errors/appErrors";
import { buildFromSnapshot, DocumentsService, type DocKind } from "@/modules/documents/documents.service";
import { PortalService } from "@/modules/portal/portal.service";

// The contract draft is an internal working document and is not served through the public link.
const PUBLIC_KINDS: DocKind[] = ["proposal", "cost_breakdown", "scope", "payment_schedule", "acceptance_record"];

export const GET = pub(async (c) => {
  const kind = (c.req.nextUrl.searchParams.get("kind") ?? "proposal") as DocKind;
  if (!PUBLIC_KINDS.includes(kind)) throw badRequest("That document is not available.");
  const { snapshot, acceptance } = await PortalService.snapshotFor(c.params.token);
  return html(DocumentsService.html(buildFromSnapshot(kind, snapshot, { acceptance })));
}, { name: "portal-doc", limit: 30 });
