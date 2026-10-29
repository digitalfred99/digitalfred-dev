import { admin } from "@/lib/http/handler";
import { getSettings, saveSettings } from "@/lib/settings";

export const GET = admin(async () => ({ data: await getSettings() }));
export const PUT = admin(async (c) => ({ data: await saveSettings(await c.json(), c.userId, c.meta) }));
