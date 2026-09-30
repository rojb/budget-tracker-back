import type { MigrationInterface, QueryRunner } from 'typeorm';

// Invitation codes of a plan (add-plan-sharing, FR-27): single use, 24 h, one pending per plan.
export class CreatePlanInvitations1790400000000 implements MigrationInterface {
  name = 'CreatePlanInvitations1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plan_invitations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "code" character(6) NOT NULL,
        "role" character varying(10) NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "used_by" uuid,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_plan_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_plan_invitations_code" UNIQUE ("code"),
        CONSTRAINT "CHK_plan_invitations_role" CHECK ("role" IN ('editor', 'viewer')),
        CONSTRAINT "FK_plan_invitations_plan" FOREIGN KEY ("plan_id")
          REFERENCES "plans" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_plan_invitations_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_plan_invitations_used_by" FOREIGN KEY ("used_by")
          REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_plan_invitations_pending"
        ON "plan_invitations" ("plan_id")
        WHERE "used_at" IS NULL AND "revoked_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "plan_invitations"`);
  }
}
