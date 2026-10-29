import "dotenv/config";
import "reflect-metadata";
import bcrypt from "bcrypt";
import { AppDataSource } from "../src/database/data-source";
import { User } from "../src/database/entities/User";
import { assertStrongPassword } from "../src/modules/auth/auth.service";

/** Creates the single dashboard owner. Usage: npm run seed:admin   (add --reset-password to change an existing password) */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.");
  assertStrongPassword(password);
  const db = await AppDataSource();
  const repo = db.getRepository(User);
  const existing = await repo.findOne({ where: { email } });
  const hash = await bcrypt.hash(password, 12);
  if (existing) {
    if (!process.argv.includes("--reset-password")) { console.log("Admin already exists. Use --reset-password to change the password."); return; }
    await repo.update(existing.id, { passwordHash: hash, tokenVersion: existing.tokenVersion + 1, failedLogins: 0, lockedUntil: null });
    console.log("Password reset; all existing sessions were signed out.");
    return;
  }
  await repo.save(repo.create({ email, passwordHash: hash, firstName: process.env.ADMIN_FIRST_NAME || "Admin", lastName: process.env.ADMIN_LAST_NAME || "User" }));
  console.log(`Admin created: ${email}. Remove ADMIN_PASSWORD from your environment now.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
