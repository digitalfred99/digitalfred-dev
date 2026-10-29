import { pub } from "@/lib/http/handler";
import { AuthService } from "@/modules/auth/auth.service";

export const POST = pub(async (c) => ({ data: await AuthService.refresh(await c.json()) }), { name: "refresh", limit: 30, windowMs: 60_000 });
