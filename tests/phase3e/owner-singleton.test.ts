import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { homeProjects, homeSections, userRoles } from "../../src/lib/db/schema";

const migration = readFileSync("drizzle/0002_many_kingpin.sql", "utf8");

test("the owner assignment contract rejects a second global owner", () => {
  const roleTable = getTableConfig(userRoles);
  const ownerIndex = roleTable.indexes.find(
    (index) => index.config.name === "app_user_roles_single_owner_uq",
  );

  assert.ok(ownerIndex, "Drizzle schema must define the singleton owner index");
  assert.equal(ownerIndex.config.unique, true);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "app_user_roles_single_owner_uq" ON "app"\."user_roles" USING btree \("role"\) WHERE "app"\."user_roles"\."role" = 'owner'/,
  );

  // Synthetic constraint contract: the partial unique index includes owner
  // assignments only, so the first succeeds, a second fails, and other roles
  // remain assignable. This is not a database-backed PostgreSQL test.
  const assignments: Array<{ userId: string; role: string }> = [];
  const assign = (userId: string, role: string) => {
    if (role === "owner" && assignments.some((assignment) => assignment.role === "owner")) {
      throw new Error("duplicate key violates the singleton owner index");
    }
    assignments.push({ userId, role });
  };

  assign("verified-owner", "owner");
  assert.throws(() => assign("second-user", "owner"), /singleton owner index/);
  assert.doesNotThrow(() => assign("admin-one", "content_admin"));
  assert.doesNotThrow(() => assign("admin-two", "content_admin"));
  assert.equal(assignments.filter((assignment) => assignment.role === "owner").length, 1);
});

test("project revisions and homepage section versions must stay positive", () => {
  assert.ok(
    getTableConfig(homeProjects).checks.some((constraint) => constraint.name === "app_home_projects_revision_ck"),
  );
  assert.ok(
    getTableConfig(homeSections).checks.some((constraint) => constraint.name === "app_home_sections_version_ck"),
  );
  assert.match(migration, /CHECK \("app"\."home_projects"\."revision" > 0\)/);
  assert.match(migration, /CHECK \("app"\."home_sections"\."version" > 0\)/);
});
