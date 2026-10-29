import { pub } from "@/lib/http/handler";
import { AuthService } from "@/modules/auth/auth.service";

export const POST = pub(async (c) => ({ data: await AuthService.login(await c.json(), c.meta) }), { name: "login", limit: 10, windowMs: 60_000 });
