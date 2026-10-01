import type { MigrationInterface, QueryRunner } from 'typeorm';

// Goal and photo of an envelope (add-envelope-goals, FR-19 and FR-41). Both are 0..1 per envelope
// and always read with it, so they are nullable columns of "envelopes" rather than tables. Only the
// user's intent is stored (type, target, due date) and the key of the photo file: the required
// amount, the state and the progress are derived on every read. Reverting drops the columns, so
// goals and photo references are lost (the files stay on disk).
export class AddEnvelopeGoalsAndPhotos1790900000000 implements MigrationInterface {
  name = 'AddEnvelopeGoalsAndPhotos1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "envelopes"
        ADD COLUMN "goal_type" character varying(16),
        ADD COLUMN "goal_target_minor" bigint,
        ADD COLUMN "goal_due_date" date,
        ADD COLUMN "photo_file" character varying(120),
        ADD COLUMN "photo_updated_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "envelopes"
        ADD CONSTRAINT "CHK_envelopes_goal_type"
          CHECK ("goal_type" IN ('monthly', 'targetByDate')),
        ADD CONSTRAINT "CHK_envelopes_goal_complete"
          CHECK (("goal_type" IS NULL) = ("goal_target_minor" IS NULL)),
        ADD CONSTRAINT "CHK_envelopes_goal_target_positive"
          CHECK ("goal_target_minor" IS NULL OR "goal_target_minor" > 0),
        ADD CONSTRAINT "CHK_envelopes_goal_due_date"
          CHECK (("goal_type" = 'targetByDate') = ("goal_due_date" IS NOT NULL)),
        ADD CONSTRAINT "CHK_envelopes_photo_complete"
          CHECK (("photo_file" IS NULL) = ("photo_updated_at" IS NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "envelopes"
        DROP CONSTRAINT "CHK_envelopes_photo_complete",
        DROP CONSTRAINT "CHK_envelopes_goal_due_date",
        DROP CONSTRAINT "CHK_envelopes_goal_target_positive",
        DROP CONSTRAINT "CHK_envelopes_goal_complete",
        DROP CONSTRAINT "CHK_envelopes_goal_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "envelopes"
        DROP COLUMN "photo_updated_at",
        DROP COLUMN "photo_file",
        DROP COLUMN "goal_due_date",
        DROP COLUMN "goal_target_minor",
        DROP COLUMN "goal_type"
    `);
  }
}
