import bcrypt from "bcrypt";
import { AppDataSource } from "@/database/data-source";
import { User } from "@/database/entities/User";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { CustomAppError } from "@/lib/errors/customAppError";
import { ErrorCodes } from "@/lib/errors/errorCodes";
import { badRequest, unauthorized } from "@/lib/errors/appErrors";
import { audit } from "@/lib/audit/audit";
import { email as vEmail, obj, str } from "@/lib/validation/v";

type Meta = { ipAddress?: string; userAgent?: string };
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.3mU3Wq8y8QZ7q8Qy0u0w6bq5e1eW";

export function assertStrongPassword(pw: unknown): asserts pw is string {
  if (typeof pw !== "string" || pw.length < 8) throw badRequest("Password must be at least 8 characters long");
  if (pw.length > 72) throw badRequest("Password must not exceed 72 characters"); // bcrypt limit
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw) || !/[^A-Za-z0-9]/.test(pw))
    throw badRequest("Password needs a lowercase letter, an uppercase letter, a number and a symbol");
}

const publicUser = (u: User) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email });

export class AuthService {
  static async login(body: unknown, meta: Meta) {
    const b = obj(body);
    const email = vEmail(b.email).toLowerCase();
    const password = str(b.password, "password", { max: 200, trim: false });
    const repo = (await AppDataSource()).getRepository(User);
    const user = await repo.findOne({ where: { email, isDeleted: false } });

    const invalid = () => new CustomAppError("Invalid email or password", 401, ErrorCodes.INVALID_CREDENTIALS.code, ErrorCodes.INVALID_CREDENTIALS.label, "unauthorized");
    if (!user) { await bcrypt.compare(password, DUMMY_HASH); await audit({ action: "auth.login_failed", entityType: "user", actorType: "system", metadata: { reason: "unknown_email" }, ...meta }); throw invalid(); }
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new CustomAppError("Too many failed attempts. Try again later.", 429, ErrorCodes.ACCOUNT_LOCKED.code, ErrorCodes.ACCOUNT_LOCKED.label, "account_locked");
    if (!user.isActive) throw invalid();

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      await repo.update(user.id, failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed });
      await audit({ action: "auth.login_failed", entityType: "user", entityId: user.id, actorType: "system", metadata: { reason: "bad_password", locked: failed >= MAX_FAILED }, ...meta });
      throw invalid();
    }
    await repo.update(user.id, { failedLogins: 0, lockedUntil: null });
    await audit({ action: "auth.login", entityType: "user", entityId: user.id, actorUserId: user.id, ...meta });
    return { user: publicUser(user), accessToken: signAccessToken(user.id, user.tokenVersion), refreshToken: signRefreshToken(user.id, user.tokenVersion) };
  }

  static async refresh(body: unknown) {
    const token = str(obj(body).refreshToken, "refreshToken", { max: 2000 });
    let payload;
    try { payload = verifyRefreshToken(token); } catch { throw unauthorized("Invalid or expired refresh token"); }
    const user = await (await AppDataSource()).getRepository(User).findOne({ where: { id: payload.sub, isDeleted: false, isActive: true } });
    if (!user || user.tokenVersion !== payload.tv) throw unauthorized("This session is no longer valid");
    return { accessToken: signAccessToken(user.id, user.tokenVersion), refreshToken: signRefreshToken(user.id, user.tokenVersion) };
  }

  static async me(userId: string) {
    const user = await (await AppDataSource()).getRepository(User).findOne({ where: { id: userId } });
    if (!user) throw unauthorized("Session no longer valid");
    return publicUser(user);
  }

  /** Bumping tokenVersion makes every issued access/refresh token invalid immediately. */
  static async logout(userId: string, meta: Meta) {
    const repo = (await AppDataSource()).getRepository(User);
    await repo.increment({ id: userId }, "tokenVersion", 1);
    await audit({ action: "auth.logout", entityType: "user", entityId: userId, actorUserId: userId, ...meta });
  }

  static async changePassword(userId: string, body: unknown, meta: Meta) {
    const b = obj(body);
    const current = str(b.currentPassword, "currentPassword", { max: 200, trim: false });
    const next = b.newPassword; assertStrongPassword(next);
    const repo = (await AppDataSource()).getRepository(User);
    const user = await repo.findOne({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
      await audit({ action: "auth.password_change_failed", entityType: "user", entityId: userId, actorUserId: userId, ...meta });
      throw new CustomAppError("Current password is incorrect", 401, ErrorCodes.INVALID_CREDENTIALS.code, ErrorCodes.INVALID_CREDENTIALS.label, "invalid_current_password");
    }
    if (await bcrypt.compare(next, user.passwordHash)) throw badRequest("New password must be different from the current one");
    await repo.update(userId, { passwordHash: await bcrypt.hash(next, 12), tokenVersion: user.tokenVersion + 1 });
    await audit({ action: "auth.password_changed", entityType: "user", entityId: userId, actorUserId: userId, ...meta });
  }
}
