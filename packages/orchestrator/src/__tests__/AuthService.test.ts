import { AuthService } from '../services/AuthService';
import { IUserRepository } from '../repositories/IUserRepository';
import { User } from '@chronos/shared';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';

function makeUserRecord(overrides: Partial<User & { passwordHash: string }> = {}): User & { passwordHash: string } {
  return {
    id: 'user-1',
    email: 'admin@test.com',
    orgId: 'org-1',
    role: 'admin',
    createdAt: new Date(),
    passwordHash: '$2b$12$placeholder',
    ...overrides,
  };
}

function makeMockRepo(): jest.Mocked<IUserRepository> {
  return {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
  };
}

describe('AuthService', () => {
  let repo: jest.Mocked<IUserRepository>;
  let service: AuthService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new AuthService(repo, JWT_SECRET);
  });

  describe('register()', () => {
    it('hashes the password and stores the user', async () => {
      const saved: User = {
        id: 'user-1',
        email: 'test@test.com',
        orgId: 'org-1',
        role: 'member',
        createdAt: new Date(),
      };
      repo.save.mockResolvedValue(saved);

      const result = await service.register('test@test.com', 'password123', 'org-1', 'member');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@test.com', orgId: 'org-1', role: 'member' }),
      );
      const call = repo.save.mock.calls[0][0];
      const valid = await bcrypt.compare('password123', call.passwordHash);
      expect(valid).toBe(true);
      expect(result).toEqual(saved);
    });

    it('does not return passwordHash in the result', async () => {
      const saved: User = { id: 'u1', email: 'a@b.com', orgId: 'o', role: 'member', createdAt: new Date() };
      repo.save.mockResolvedValue(saved);
      const result = await service.register('a@b.com', 'pass', 'o', 'member');
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });
  });

  describe('login()', () => {
    it('returns null when user is not found', async () => {
      repo.findByEmail.mockResolvedValue(null);
      const result = await service.login('noone@test.com', 'pass');
      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 12);
      repo.findByEmail.mockResolvedValue(makeUserRecord({ passwordHash: hash }));
      const result = await service.login('admin@test.com', 'wrong');
      expect(result).toBeNull();
    });

    it('returns an AuthSession with JWT when credentials are correct', async () => {
      const hash = await bcrypt.hash('correct', 12);
      repo.findByEmail.mockResolvedValue(makeUserRecord({ passwordHash: hash }));
      const session = await service.login('admin@test.com', 'correct');
      expect(session).not.toBeNull();
      expect(session!.token).toBeTruthy();
      expect(session!.user.email).toBe('admin@test.com');
      expect(session!.expiresAt).toBeTruthy();
    });
  });

  describe('verifyToken()', () => {
    it('returns the user when the token is valid', async () => {
      const record = makeUserRecord();
      const token = jwt.sign(
        { sub: record.id, email: record.email, orgId: record.orgId, role: record.role },
        JWT_SECRET,
        { expiresIn: 3600 },
      );
      const user: User = { id: record.id, email: record.email, orgId: record.orgId, role: record.role, createdAt: record.createdAt };
      repo.findById.mockResolvedValue(user);

      const result = await service.verifyToken(token);
      expect(result.id).toBe(record.id);
    });

    it('throws when token is expired', async () => {
      const token = jwt.sign({ sub: 'u1' }, JWT_SECRET, { expiresIn: -1 });
      await expect(service.verifyToken(token)).rejects.toThrow();
    });

    it('throws when token is invalid', async () => {
      await expect(service.verifyToken('not.a.token')).rejects.toThrow();
    });

    it('throws when user not found in DB', async () => {
      const token = jwt.sign({ sub: 'missing', email: 'x@x.com', orgId: 'o', role: 'member' }, JWT_SECRET, { expiresIn: 3600 });
      repo.findById.mockResolvedValue(null);
      await expect(service.verifyToken(token)).rejects.toThrow('User not found');
    });
  });

  describe('bootstrapIfEmpty()', () => {
    it('creates admin when no users exist', async () => {
      repo.count.mockResolvedValue(0);
      repo.save.mockResolvedValue({
        id: 'u1',
        email: 'admin@chronos.dev',
        orgId: 'my-org',
        role: 'admin',
        createdAt: new Date(),
      });

      await service.bootstrapIfEmpty('admin@chronos.dev', 'pass', 'my-org');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'admin@chronos.dev', orgId: 'my-org', role: 'admin' }),
      );
    });

    it('does nothing when users already exist', async () => {
      repo.count.mockResolvedValue(3);
      await service.bootstrapIfEmpty('admin@chronos.dev', 'pass', 'my-org');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('does nothing when email is empty', async () => {
      await service.bootstrapIfEmpty('', 'pass', 'org');
      expect(repo.count).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('does nothing when password is empty', async () => {
      await service.bootstrapIfEmpty('admin@test.com', '', 'org');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
