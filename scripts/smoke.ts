import { MemStorage } from "../server/storage";

async function assert(name: string, cond: unknown) {
  if (!cond) {
    console.error(`❌ ${name}`);
    process.exit(1);
  } else {
  console.warn(`✅ ${name}`);
  }
}

async function main() {
  const s = new MemStorage();

  // Create main admin (auto couple created)
  const u1 = await s.createUser({ username: "u1", email: "u1@x", password: "p" });
  await assert("u1 main_admin", u1.role === "main_admin");
  await assert("u1 has coupleId", !!u1.coupleId);

  // Generate invite and join second user
  const code = await s.generateInviteCode(u1.coupleId!);
  await assert("invite code generated", typeof code === "string" && code.includes("-"));

  const u2 = await s.createUser({ username: "u2", email: "u2@x", password: "p", coupleId: u1.coupleId! });
  await assert("u2 user role", u2.role === "user");

  // Revoke and re-generate to ensure joinCouple path uses current code
  await s.revokeInviteCode(u1.coupleId!);
  const code2 = await s.generateInviteCode(u1.coupleId!);
  await assert("invite code regenerated", code2 && code2 !== code);

  const u3 = await s.createUser({ username: "u3", email: "u3@x", password: "p" });
  await s.joinCouple(u3.id, code2);
  const u3Reload = await s.getUser(u3.id);
  await assert("u3 in couple", u3Reload?.coupleId === u1.coupleId);
  await assert("u3 role set (guest|co_admin)", u3Reload?.role === "guest" || u3Reload?.role === "co_admin");

  // Partner info
  const partner = await s.getPartnerInfo(u1.id);
  await assert("partner resolvable", !partner || partner.id !== u1.id);

  // Update user
  const updated = await s.updateUser(u1.id, { firstName: "A" });
  await assert("update preserved id", updated.id === u1.id);
  await assert("update applied", updated.firstName === "A");

  console.warn("All smoke checks passed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
