import { admin } from "@/lib/http/handler";
import { AuthService } from "@/modules/auth/auth.service";
import { AppDataSource } from "@/database/data-source";
import { User } from "@/database/entities/User";
import { audit } from "@/lib/audit/audit";
import { email, obj, str } from "@/lib/validation/v";
import { conflict } from "@/lib/errors/appErrors";

export const GET = admin(async (c) => ({ data: await AuthService.me(c.userId) }));

export const PATCH = admin(async (c) => {
  const b = obj(await c.json());
  const repo = (await AppDataSource()).getRepository(User);
  const patch: Partial<User> = {};
  if (b.firstName !== undefined) patch.firstName = str(b.firstName, "firstName", { max: 255 });
  if (b.lastName !== undefined) patch.lastName = str(b.lastName, "lastName", { max: 255 });
  if (b.email !== undefined) {
    patch.email = email(b.email).toLowerCase();
    const taken = await repo.findOne({ where: { email: patch.email } });
    if (taken && taken.id !== c.userId) throw conflict("That email is already in use");
  }
  await repo.update(c.userId, patch);
  await audit({ action: "auth.profile_updated", entityType: "user", entityId: c.userId, actorUserId: c.userId, metadata: { fields: Object.keys(patch) }, ...c.meta });
  return { data: await AuthService.me(c.userId) };
});