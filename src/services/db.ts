import { D1Database } from "@cloudflare/workers-types";
import { UserStatus } from "../types";

export type User = {
  id: string;
  name: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  aad_id?: string;
  aad_display_name?: string;
};

export async function updateOrgMemberVerification(
  db: D1Database,
  githubId: string,
  orgName: string
) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO org_members (github_id, org_name, last_verified_at)
    VALUES (?, ?, ?)
    ON CONFLICT (github_id) DO UPDATE SET
      last_verified_at = excluded.last_verified_at
  `).bind(githubId, orgName, now).run();
}

export async function getLastVerification(
  db: D1Database,
  githubId: string
) {
  return await db.prepare(`
    SELECT last_verified_at FROM org_members WHERE github_id = ?
  `).bind(githubId).first();
}

export async function createOrUpdateUser(
  db: D1Database,
  id: string,
  name: string,
  status: UserStatus
) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO users (id, name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).bind(id, name, status, now, now).run();
}

export async function updateUserStatus(
  db: D1Database,
  id: string,
  status: UserStatus
) {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE users SET status = ?, updated_at = ? WHERE id = ?
  `).bind(status, now, id).run();
}

export async function createAADUser(
  db: D1Database,
  userId: string,
  aadId: string
) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO aad_users (id, user_id, aad_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), userId, aadId, now, now).run();
}

export async function getUserWithAAD(db: D1Database, userId: string): Promise<User | null> {
  return await db.prepare(`
    SELECT u.*, a.aad_id
    FROM users u
    LEFT JOIN aad_users a ON u.id = a.user_id
    WHERE u.id = ?
  `).bind(userId).first<User>();
}

export async function getAADUser(db: D1Database, userId: string) {
  return await db.prepare(`
    SELECT * FROM aad_users WHERE user_id = ?
  `).bind(userId).first();
} 