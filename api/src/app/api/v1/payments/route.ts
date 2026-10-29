import { admin } from "@/lib/http/handler";
import { PaymentsService } from "@/modules/payments/payments.service";

export const GET = admin(async (c) => ({ data: await PaymentsService.list(c.req.nextUrl.searchParams) }));
