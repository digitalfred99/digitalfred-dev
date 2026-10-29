import { admin } from "@/lib/http/handler";
import { AuthService } from "@/modules/auth/auth.service";

export const POST = admin(async (c) => { await AuthService.logout(c.userId, c.meta); return { data: { loggedOut: true } }; });
