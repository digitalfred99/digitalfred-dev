import { MigrationInterface, QueryRunner } from "typeorm";

export class Schema1793246465919 implements MigrationInterface {
    name = 'Schema1793246465919'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorUserId" uuid, "actorType" character varying(20) NOT NULL DEFAULT 'admin', "action" character varying(80) NOT NULL, "entityType" character varying(60) NOT NULL, "entityId" character varying(64), "metadata" jsonb, "ipAddress" character varying(64), "userAgent" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_audit_created" ON "audit_logs"  ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_audit_entity" ON "audit_logs"  ("entityType", "entityId") `);
        await queryRunner.query(`CREATE TABLE "change_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "projectId" uuid NOT NULL, "amendmentProposalId" uuid, "title" character varying(255) NOT NULL, "description" text NOT NULL, "requestedBy" character varying(255) NOT NULL DEFAULT '', "additionalWork" text NOT NULL DEFAULT '', "estimateMinor" bigint, "currency" character varying(3) NOT NULL DEFAULT 'GHS', "timelineImpact" text NOT NULL DEFAULT '', "status" character varying(20) NOT NULL DEFAULT 'draft', CONSTRAINT "PK_e3f28255a6e818820f18f6d5956" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cr_project" ON "change_requests"  ("projectId") `);
        await queryRunner.query(`CREATE TABLE "clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "type" character varying(20) NOT NULL DEFAULT 'organization', "displayName" character varying(255) NOT NULL, "organizationName" character varying(255), "contactName" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "phone" character varying(40), "country" character varying(100) NOT NULL DEFAULT 'Ghana', "preferredCurrency" character varying(3) NOT NULL DEFAULT 'GHS', "billingAddress" text, "taxId" character varying(120), "internalNotes" text, CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_clients_name" ON "clients"  ("displayName") `);
        await queryRunner.query(`CREATE TABLE "counters" ("key" character varying(64) NOT NULL, "value" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_c6c33328f872db2d0aaabbacbc8" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "document_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "kind" character varying(30) NOT NULL, "name" character varying(200) NOT NULL, "sections" jsonb NOT NULL DEFAULT '[]', "isDefault" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_0372838b7b7cd3571aef80466d1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "clientId" uuid, "name" character varying(255) NOT NULL, "identifier" character varying(64) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'draft', "description" text NOT NULL DEFAULT '', "businessProblem" text NOT NULL DEFAULT '', "proposedSolution" text NOT NULL DEFAULT '', "scope" text NOT NULL DEFAULT '', "lists" jsonb NOT NULL DEFAULT '{}', "terms" jsonb NOT NULL DEFAULT '{}', "timelineNotes" text NOT NULL DEFAULT '', "startDate" date, "targetDate" date, CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_projects_identifier" ON "projects"  ("identifier") WHERE "isDeleted" = false`);
        await queryRunner.query(`CREATE TABLE "milestones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "projectId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "dueDate" date, "status" character varying(20) NOT NULL DEFAULT 'planned', "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_0bdbfe399c777a6a8520ff902d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_milestones_due" ON "milestones"  ("dueDate") `);
        await queryRunner.query(`CREATE TABLE "negotiation_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requestId" uuid NOT NULL, "author" character varying(10) NOT NULL, "visibility" character varying(10) NOT NULL, "body" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_45a253acec7bed610599cd34db5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_negmsg_request" ON "negotiation_messages"  ("requestId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "negotiation_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "proposalId" uuid NOT NULL, "versionId" uuid NOT NULL, "versionLabel" character varying(20) NOT NULL, "kind" character varying(30) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'open', "subject" character varying(255) NOT NULL, "message" text NOT NULL, "reason" text, "proposedBudgetMinor" bigint, "proposedPaymentTerms" text, "selections" jsonb, "submittedByName" character varying(255) NOT NULL, "submittedByEmail" character varying(255) NOT NULL, "resolutionNote" text, "resolvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_448f6146b7955e03358ccf92ee1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_neg_status" ON "negotiation_requests"  ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_neg_proposal" ON "negotiation_requests"  ("proposalId") `);
        await queryRunner.query(`CREATE TABLE "payment_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "proposalId" uuid NOT NULL, "versionId" uuid NOT NULL, "itemKey" character varying(64) NOT NULL, "label" character varying(255) NOT NULL, "amountMinor" bigint, "currency" character varying(3) NOT NULL, "dueDate" date, "status" character varying(12) NOT NULL DEFAULT 'pending', "paidAt" TIMESTAMP WITH TIME ZONE, "paymentReference" character varying(120), "notes" text, CONSTRAINT "PK_1770b3d8261895c6bafd8faef91" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_payment_item" ON "payment_records"  ("versionId", "itemKey") `);
        await queryRunner.query(`CREATE INDEX "IDX_payments_proposal" ON "payment_records"  ("proposalId") `);
        await queryRunner.query(`CREATE TABLE "proposals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "reference" character varying(40) NOT NULL, "kind" character varying(20) NOT NULL DEFAULT 'proposal', "parentProposalId" uuid, "projectId" uuid NOT NULL, "clientId" uuid, "title" character varying(255) NOT NULL, "currency" character varying(3) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'draft', "draft" jsonb NOT NULL, "draftRevision" integer NOT NULL DEFAULT '1', "validityDays" integer, "latestVersionId" uuid, "latestVersionLabel" character varying(20), "validUntil" TIMESTAMP WITH TIME ZONE, "sentAt" TIMESTAMP WITH TIME ZONE, "acceptedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_db524c8db8e126a38a2f16d8cac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_proposals_status" ON "proposals"  ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_proposals_reference" ON "proposals"  ("reference") `);
        await queryRunner.query(`CREATE TABLE "proposal_acceptances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "proposalId" uuid NOT NULL, "versionId" uuid NOT NULL, "versionLabel" character varying(20) NOT NULL, "proposalReference" character varying(40) NOT NULL, "contentHash" character(64) NOT NULL, "acceptedByName" character varying(255) NOT NULL, "acceptedByEmail" character varying(255) NOT NULL, "acceptedByTitle" character varying(255), "organization" character varying(255), "statement" text NOT NULL, "method" character varying(40) NOT NULL DEFAULT 'web_acknowledgment', "ipAddress" character varying(64), "userAgent" text, "accessLinkId" uuid, "acceptedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_090dac8cb18b18bcd0ee45c2b78" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_acceptance_version" ON "proposal_acceptances"  ("versionId") `);
        await queryRunner.query(`CREATE TABLE "proposal_access_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "proposalId" uuid NOT NULL, "tokenHash" character(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE, "revokedAt" TIMESTAMP WITH TIME ZONE, "lastViewedAt" TIMESTAMP WITH TIME ZONE, "viewCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a08a171ddfda2524b28398d85c0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_link_proposal" ON "proposal_access_links"  ("proposalId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_link_token_hash" ON "proposal_access_links"  ("tokenHash") `);
        await queryRunner.query(`CREATE TABLE "proposal_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "proposalId" uuid NOT NULL, "major" integer NOT NULL, "minor" integer NOT NULL, "label" character varying(20) NOT NULL, "content" jsonb NOT NULL, "contentHash" character(64) NOT NULL, "changeNote" text NOT NULL DEFAULT '', "validUntil" TIMESTAMP WITH TIME ZONE, "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_64c09e1dd58aebaa26ab09bb528" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_proposal_version" ON "proposal_versions"  ("proposalId", "major", "minor") `);
        await queryRunner.query(`CREATE TABLE "requirements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "projectId" uuid NOT NULL, "kind" character varying(20) NOT NULL, "code" character varying(20) NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL DEFAULT '', "priority" character varying(10) NOT NULL DEFAULT 'must', "dependencies" jsonb NOT NULL DEFAULT '[]', "acceptanceCriteria" jsonb NOT NULL DEFAULT '[]', "status" character varying(12) NOT NULL DEFAULT 'draft', "sortOrder" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_4e966e20a0ebaf89e4c1ed664a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_requirements_code" ON "requirements"  ("projectId", "code") WHERE "isDeleted" = false`);
        await queryRunner.query(`CREATE TABLE "service_catalog" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "name" character varying(200) NOT NULL, "provider" character varying(200) NOT NULL DEFAULT '', "category" character varying(100) NOT NULL DEFAULT '', "description" text NOT NULL DEFAULT '', "options" jsonb NOT NULL DEFAULT '[]', "notes" text NOT NULL DEFAULT '', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_f2ba61b59fc13ea8e34acc75aa5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "settings" ("key" character varying(64) NOT NULL, "value" jsonb NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c8639b7626fa94ba8265628f214" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "srs_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "title" character varying(255) NOT NULL, "sections" jsonb NOT NULL DEFAULT '[]', "revision" integer NOT NULL DEFAULT '1', "status" character varying(20) NOT NULL DEFAULT 'draft', "clientReviewStatus" character varying(20) NOT NULL DEFAULT 'not_shared', "latestVersionLabel" character varying(20), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_7e6ed72d9d43f83d1379bd8026" UNIQUE ("projectId"), CONSTRAINT "PK_54415a93c9be2a51d0b76345bc2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_srs_project" ON "srs_documents"  ("projectId") `);
        await queryRunner.query(`CREATE TABLE "srs_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "documentId" uuid NOT NULL, "projectId" uuid NOT NULL, "major" integer NOT NULL, "minor" integer NOT NULL, "label" character varying(20) NOT NULL, "title" character varying(255) NOT NULL, "sections" jsonb NOT NULL, "requirements" jsonb NOT NULL, "contentHash" character(64) NOT NULL, "note" text NOT NULL DEFAULT '', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b03ae8eceeea36b4b37b14ce8ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_srs_version" ON "srs_versions"  ("documentId", "major", "minor") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isDeleted" boolean NOT NULL DEFAULT false, "firstName" character varying(255) NOT NULL, "lastName" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "tokenVersion" integer NOT NULL DEFAULT '0', "failedLogins" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email" ON "users"  ("email") `);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_091f9433895a53408cb8ae3864f" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "proposals" ADD CONSTRAINT "FK_d9184f05fdd28bd7c960d9a7e40" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "proposals" ADD CONSTRAINT "FK_b32ff9b507ed64012d1dfc10d1e" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requirements" ADD CONSTRAINT "FK_bc1f7e3b02fa4e00b380840ab57" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "srs_documents" ADD CONSTRAINT "FK_7e6ed72d9d43f83d1379bd80265" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "srs_documents" DROP CONSTRAINT "FK_7e6ed72d9d43f83d1379bd80265"`);
        await queryRunner.query(`ALTER TABLE "requirements" DROP CONSTRAINT "FK_bc1f7e3b02fa4e00b380840ab57"`);
        await queryRunner.query(`ALTER TABLE "proposals" DROP CONSTRAINT "FK_b32ff9b507ed64012d1dfc10d1e"`);
        await queryRunner.query(`ALTER TABLE "proposals" DROP CONSTRAINT "FK_d9184f05fdd28bd7c960d9a7e40"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_091f9433895a53408cb8ae3864f"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_srs_version"`);
        await queryRunner.query(`DROP TABLE "srs_versions"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_srs_project"`);
        await queryRunner.query(`DROP TABLE "srs_documents"`);
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`DROP TABLE "service_catalog"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_requirements_code"`);
        await queryRunner.query(`DROP TABLE "requirements"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_proposal_version"`);
        await queryRunner.query(`DROP TABLE "proposal_versions"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_link_token_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_link_proposal"`);
        await queryRunner.query(`DROP TABLE "proposal_access_links"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_acceptance_version"`);
        await queryRunner.query(`DROP TABLE "proposal_acceptances"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_proposals_reference"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_proposals_status"`);
        await queryRunner.query(`DROP TABLE "proposals"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_proposal"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_payment_item"`);
        await queryRunner.query(`DROP TABLE "payment_records"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_neg_proposal"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_neg_status"`);
        await queryRunner.query(`DROP TABLE "negotiation_requests"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_negmsg_request"`);
        await queryRunner.query(`DROP TABLE "negotiation_messages"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_milestones_due"`);
        await queryRunner.query(`DROP TABLE "milestones"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_projects_identifier"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TABLE "document_templates"`);
        await queryRunner.query(`DROP TABLE "counters"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_clients_name"`);
        await queryRunner.query(`DROP TABLE "clients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cr_project"`);
        await queryRunner.query(`DROP TABLE "change_requests"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_entity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_audit_created"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
    }

}
