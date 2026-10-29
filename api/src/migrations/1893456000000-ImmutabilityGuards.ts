import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Database-level protection for the historical record.
 *
 * Runs AFTER the schema migration (its timestamp is deliberately later than any generated one).
 * Published proposal versions, requirement-document versions, acceptance records and the audit log
 * can be inserted but never updated or deleted, even by buggy application code or a stray SQL statement.
 */
const TABLES = ["proposal_versions", "srs_versions", "proposal_acceptances", "audit_logs"];

export class ImmutabilityGuards1893456000000 implements MigrationInterface {
  name = "ImmutabilityGuards1893456000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
      END;
      $$ LANGUAGE plpgsql;
    `);
    for (const t of TABLES) {
      await q.query(`DROP TRIGGER IF EXISTS ${t}_immutable ON "${t}"`);
      await q.query(`CREATE TRIGGER ${t}_immutable BEFORE UPDATE OR DELETE ON "${t}" FOR EACH ROW EXECUTE FUNCTION forbid_change()`);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of TABLES) await q.query(`DROP TRIGGER IF EXISTS ${t}_immutable ON "${t}"`);
    await q.query(`DROP FUNCTION IF EXISTS forbid_change()`);
  }
}
