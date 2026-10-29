import { admin } from "@/lib/http/handler";
import { ProjectsService } from "@/modules/projects/projects.service";

export const GET = admin(async (c) => ({ data: await ProjectsService.listChangeRequests(c.params.id) }));
export const POST = admin(async (c) => ({ status: 201, data: await ProjectsService.createChangeRequest(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
