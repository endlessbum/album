import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../server/storage';

describe('MemStorage', () => {
  let s: MemStorage;
  beforeEach(() => {
    s = new MemStorage();
  });

  it('creates user and auto-creates couple for main_admin', async () => {
    const u1 = await s.createUser({ username: 'u1', email: 'u1@x', password: 'p' });
    expect(u1.role).toBe('main_admin');
    expect(u1.coupleId).toBeTruthy();
    const couple = await s.getCoupleById(u1.coupleId!);
    expect(couple?.mainAdminId).toBe(u1.id);
  });

  it('generates/revokes invite code and allows joinCouple with role assignment', async () => {
    const u1 = await s.createUser({ username: 'u1', email: 'u1@x', password: 'p' });
    const code = await s.generateInviteCode(u1.coupleId!);
    expect(typeof code).toBe('string');
    expect(code).toMatch(/-/);

    // Revoke and re-generate
    await s.revokeInviteCode(u1.coupleId!);
    const code2 = await s.generateInviteCode(u1.coupleId!);
    expect(code2).not.toBe(code);

    const u2 = await s.createUser({ username: 'u2', email: 'u2@x', password: 'p' });
    await s.joinCouple(u2.id, code2);
    const u2Reload = await s.getUser(u2.id);
    expect(u2Reload?.coupleId).toBe(u1.coupleId);
    expect(['guest', 'co_admin']).toContain(u2Reload?.role);
  });

  it('returns partner info for users in same couple', async () => {
    const u1 = await s.createUser({ username: 'u1', email: 'u1@x', password: 'p' });
    const invite = await s.generateInviteCode(u1.coupleId!);
    const u2 = await s.createUser({ username: 'u2', email: 'u2@x', password: 'p' });
    await s.joinCouple(u2.id, invite);
    const partner = await s.getPartnerInfo(u1.id);
    expect(partner && partner.id).not.toBe(u1.id);
  });

  it('updates user fields safely preserving id', async () => {
    const u1 = await s.createUser({ username: 'u1', email: 'u1@x', password: 'p' });
    const updated = await s.updateUser(u1.id, { firstName: 'Alice' });
    expect(updated.id).toBe(u1.id);
    expect(updated.firstName).toBe('Alice');
  });

  it('updates couple settings merging keys', async () => {
    const u1 = await s.createUser({ username: 'u1', email: 'u1@x', password: 'p' });
    const c1 = await s.updateCoupleSettings(u1.coupleId!, { theme: 'dark' } as any);
    expect(c1.settings?.theme).toBe('dark');
    const c2 = await s.updateCoupleSettings(u1.coupleId!, { locale: 'ru' } as any);
    expect(c2.settings?.theme).toBe('dark');
    expect(c2.settings?.locale).toBe('ru');
  });
});
