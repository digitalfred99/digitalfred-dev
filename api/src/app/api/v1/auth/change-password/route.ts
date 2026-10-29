import { admin } from "@/lib/http/handler";
import { AuthService } from "@/modules/auth/auth.service";

export const POST = admin(async (c) => { await AuthService.changePassword(c.userId, await c.json(), c.meta); return { data: { changed: true } }; });
