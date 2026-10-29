import { admin } from "@/lib/http/handler";
import { ProjectsService } from "@/modules/projects/projects.service";

export const POST = admin(async (c) => ({ status: 201, data: await ProjectsService.createMilestone(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
