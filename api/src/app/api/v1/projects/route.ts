import { admin } from "@/lib/http/handler";
import { ProjectsService } from "@/modules/projects/projects.service";

export const GET = admin(async (c) => ProjectsService.list(c.req.nextUrl.searchParams));
export const POST = admin(async (c) => ({ status: 201, data: await ProjectsService.create(await c.json(), { userId: c.userId, ...c.meta }) }));
