import { pub } from "@/lib/http/handler";
import { ClientsService } from "@/modules/clients/clients.service";

export const POST = pub(
  async (c) => ({
    status: 201,
    data: await ClientsService.createFromPublicIntake(await c.json(), c.meta),
  }),
  { name: "public-client-intake", limit: 5, windowMs: 600_000 },
);
