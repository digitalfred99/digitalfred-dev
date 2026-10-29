import { AppDataSource } from "@/database/data-source";
import { DocumentTemplate, TEMPLATE_KINDS } from "@/database/entities/DocumentTemplate";
import { ServiceCatalogItem } from "@/database/entities/ServiceCatalogItem";
import { audit } from "@/lib/audit/audit";
import { notFound } from "@/lib/errors/appErrors";
import { sanitizePricing } from "@/lib/pricing/validate";
import { bool, obj, oneOf, str, uuid, ValidationError } from "@/lib/validation/v";

type Actor = { userId: string; ipAddress?: string; userAgent?: string };
const A = (a: Actor) => ({ actorUserId: a.userId, ipAddress: a.ipAddress, userAgent: a.userAgent });

export class CatalogService {
  private static sanitizeService(raw: unknown, partial: boolean) {
    const b = obj(raw); const out: Partial<ServiceCatalogItem> = {};
    if (!partial || b.name !== undefined) out.name = str(b.name, "name", { max: 200 });
    for (const k of ["provider", "category"] as const) if (b[k] !== undefined) out[k] = str(b[k], k, { optional: true, max: 200 });
    for (const k of ["description", "notes"] as const) if (b[k] !== undefined) out[k] = str(b[k], k, { optional: true, max: 5000 });
    if (b.isActive !== undefined) out.isActive = bool(b.isActive, "isActive");
    if (b.options !== undefined) {
      // Reuse the pricing validator so catalog options obey exactly the same rules as proposal options.
      out.options = sanitizePricing({ currency: "GHS", services: [{ name: "x", options: b.options }] }, "GHS").services[0].options;
    }
    return out;
  }
  static async listServices() { return (await AppDataSource()).getRepository(ServiceCatalogItem).find({ where: { isDeleted: false }, order: { name: "ASC" } }); }
  static async createService(raw: unknown, a: Actor) {
    const data = this.sanitizeService(raw, false);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const saved = await m.getRepository(ServiceCatalogItem).save(m.getRepository(ServiceCatalogItem).create({ options: [], ...data }));
      await audit({ action: "catalog_service.created", entityType: "service_catalog", entityId: saved.id, ...A(a) }, m);
      return saved;
    });
  }
  static async updateService(id: string, raw: unknown, a: Actor) {
    uuid(id); const patch = this.sanitizeService(raw, true);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const r = await m.getRepository(ServiceCatalogItem).findOne({ where: { id, isDeleted: false } });
      if (!r) throw notFound("Service");
      const saved = await m.getRepository(ServiceCatalogItem).save(m.getRepository(ServiceCatalogItem).merge(r, patch));
      await audit({ action: "catalog_service.updated", entityType: "service_catalog", entityId: id, ...A(a) }, m);
      return saved;
    });
  }
  static async deleteService(id: string, a: Actor) {
    uuid(id);
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      if (!(await m.getRepository(ServiceCatalogItem).findOne({ where: { id, isDeleted: false } }))) throw notFound("Service");
      await m.getRepository(ServiceCatalogItem).update(id, { isDeleted: true }); // proposals keep their own copy
      await audit({ action: "catalog_service.deleted", entityType: "service_catalog", entityId: id, ...A(a) }, m);
    });
  }

  // ── Templates ──
  private static sanitizeTemplate(raw: unknown, partial: boolean) {
    const b = obj(raw); const out: Partial<DocumentTemplate> = {};
    if (!partial || b.kind !== undefined) out.kind = oneOf(b.kind, "kind", TEMPLATE_KINDS);
    if (!partial || b.name !== undefined) out.name = str(b.name, "name", { max: 200 });
    if (b.isDefault !== undefined) out.isDefault = bool(b.isDefault, "isDefault");
    if (b.sections !== undefined) {
      if (!Array.isArray(b.sections) || b.sections.length > 80) throw new ValidationError("sections: must be a list (max 80)", "sections");
      out.sections = b.sections.map((x, i) => { const s = obj(x, `sections[${i}]`); return { key: str(s.key ?? "custom", "key", { max: 64 }), title: str(s.title, "title", { max: 200 }), body: str(s.body, "body", { optional: true, max: 60000, trim: false }) }; });
    }
    return out;
  }
  static async listTemplates(kind?: string | null) {
    const where: Record<string, unknown> = { isDeleted: false };
    if (kind) where.kind = oneOf(kind, "kind", TEMPLATE_KINDS);
    return (await AppDataSource()).getRepository(DocumentTemplate).find({ where, order: { kind: "ASC", name: "ASC" } });
  }
  static async createTemplate(raw: unknown, a: Actor) {
    const data = this.sanitizeTemplate(raw, false);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      if (data.isDefault) await m.getRepository(DocumentTemplate).update({ kind: data.kind, isDefault: true }, { isDefault: false });
      const saved = await m.getRepository(DocumentTemplate).save(m.getRepository(DocumentTemplate).create({ sections: [], ...data }));
      await audit({ action: "template.created", entityType: "template", entityId: saved.id, ...A(a) }, m);
      return saved;
    });
  }
  static async updateTemplate(id: string, raw: unknown, a: Actor) {
    uuid(id); const patch = this.sanitizeTemplate(raw, true);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const r = await m.getRepository(DocumentTemplate).findOne({ where: { id, isDeleted: false } });
      if (!r) throw notFound("Template");
      if (patch.isDefault) await m.getRepository(DocumentTemplate).update({ kind: r.kind, isDefault: true }, { isDefault: false });
      const saved = await m.getRepository(DocumentTemplate).save(m.getRepository(DocumentTemplate).merge(r, patch));
      await audit({ action: "template.updated", entityType: "template", entityId: id, ...A(a) }, m);
      return saved;
    });
  }
  static async deleteTemplate(id: string, a: Actor) {
    uuid(id);
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      if (!(await m.getRepository(DocumentTemplate).findOne({ where: { id, isDeleted: false } }))) throw notFound("Template");
      await m.getRepository(DocumentTemplate).update(id, { isDeleted: true });
      await audit({ action: "template.deleted", entityType: "template", entityId: id, ...A(a) }, m);
    });
  }
}
