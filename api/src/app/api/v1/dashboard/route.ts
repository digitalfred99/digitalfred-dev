import { admin } from "@/lib/http/handler";
import { DashboardService } from "@/modules/dashboard/dashboard.service";

export const GET = admin(async () => ({ data: await DashboardService.overview() }));
