import "reflect-metadata";
import type { DataSourceOptions } from "typeorm";

import { AuditLog } from "./entities/AuditLog";
import { ChangeRequest } from "./entities/ChangeRequest";
import { Client } from "./entities/Client";
import { Counter } from "./entities/Counter";
import { DocumentTemplate } from "./entities/DocumentTemplate";
import { Milestone } from "./entities/Milestone";
import { NegotiationMessage } from "./entities/NegotiationMessage";
import { NegotiationRequest } from "./entities/NegotiationRequest";
import { PaymentRecord } from "./entities/PaymentRecord";
import { Project } from "./entities/Project";
import { Proposal } from "./entities/Proposal";
import { ProposalAcceptance } from "./entities/ProposalAcceptance";
import { ProposalAccessLink } from "./entities/ProposalAccessLink";
import { ProposalVersion } from "./entities/ProposalVersion";
import { Requirement } from "./entities/Requirement";
import { ServiceCatalogItem } from "./entities/ServiceCatalogItem";
import { Setting } from "./entities/Setting";
import { SrsDocument } from "./entities/SrsDocument";
import { SrsVersion } from "./entities/SrsVersion";
import { User } from "./entities/User";

const namedEntities = {
  AuditLog, ChangeRequest, Client, Counter, DocumentTemplate, Milestone, NegotiationMessage, NegotiationRequest,
  PaymentRecord, Project, Proposal, ProposalAcceptance, ProposalAccessLink, ProposalVersion, Requirement,
  ServiceCatalogItem, Setting, SrsDocument, SrsVersion, User,
} as const;

// Pin class names so minification can't rename them (prevents TypeORM "Cyclic dependency" errors).
for (const [name, cls] of Object.entries(namedEntities)) {
  if (cls.name !== name) Object.defineProperty(cls, "name", { value: name, configurable: true });
}

export const entities = Object.values(namedEntities);

export function buildOptions(): DataSourceOptions {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  if (process.env.NODE_ENV === "test" && !/test/i.test(url)) {
    throw new Error("Refusing to run tests: DATABASE_URL does not look like a test database.");
  }

  // Local Postgres usually has no SSL; hosted ones (Neon, Supabase) require it. Override with DATABASE_SSL=true|false.
  const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  const useSsl = process.env.DATABASE_SSL !== undefined ? process.env.DATABASE_SSL === "true" : !isLocal;

  return {
    type: "postgres",
    url,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities,
  };
}
