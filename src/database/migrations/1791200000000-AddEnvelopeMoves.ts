import type { MigrationInterface, QueryRunner } from 'typeorm';

// History of the moves of money between envelopes (add-envelope-move-history, FR-24, FR-25). It is
// only read to list the activity of an envelope: no figure is computed from it. Both envelope FKs
// are SET NULL and the names are stored, so deleting an envelope keeps the move in the other
// envelope's activity. Reverting drops the table; nothing depends on it.
export class AddEnvelopeMoves1791200000000 implements MigrationInterface {
  name = 'AddEnvelopeMoves1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "envelope_moves" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "from_envelope_id" uuid,
        "to_envelope_id" uuid,
        "from_envelope_name" character varying(60) NOT NULL,
        "to_envelope_name" character varying(60) NOT NULL,
        "amount_minor" bigint NOT NULL,
        "month" character(7) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_envelope_moves_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_envelope_moves_amount" CHECK ("amount_minor" > 0),
        CONSTRAINT "CHK_envelope_moves_month" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
        CONSTRAINT "FK_envelope_moves_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_envelope_moves_from" FOREIGN KEY ("from_envelope_id")
          REFERENCES "envelopes" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_envelope_moves_to" FOREIGN KEY ("to_envelope_id")
          REFERENCES "envelopes" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_envelope_moves_from" ON "envelope_moves" ("from_envelope_id", "month")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_envelope_moves_to" ON "envelope_moves" ("to_envelope_id", "month")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "envelope_moves"`);
  }
}
