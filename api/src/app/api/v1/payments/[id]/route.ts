import { admin } from "@/lib/http/handler";
import { PaymentsService } from "@/modules/payments/payments.service";

export const PATCH = admin(async (c) => ({ data: await PaymentsService.update(c.params.id, await c.json(), { userId: c.userId, ...c.meta }) }));
