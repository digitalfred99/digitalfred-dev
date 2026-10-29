import { admin } from "@/lib/http/handler";
import { ProjectsService } from "@/modules/projects/projects.service";

export const PATCH = admin(async (c) => ({ data: await ProjectsService.updateChangeRequest(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
