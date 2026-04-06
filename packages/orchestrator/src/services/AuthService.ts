import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, AuthSession, NotFoundError } from '@chronos/shared';
import { IUserRepository } from '../repositories/IUserRepository';
import { createLogger } from '@chronos/shared';

const logger = createLogger('orchestrator');

const SALT_ROUNDS = 12;
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly jwtSecret: string,
  ) {}

  async register(
    email: string,
    password: string,
    orgId: string,
    role: 'admin' | 'member',
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.userRepo.save({ email, passwordHash, orgId, role });
    logger.info('User registered', { userId: user.id, email: user.email, orgId, role });
    return user;
  }

  async login(email: string, password: string): Promise<AuthSession | null> {
    const record = await this.userRepo.findByEmail(email);
    if (!record) return null;

    const valid = await bcrypt.compare(password, record.passwordHash);
    if (!valid) return null;

    const user: User = {
      id: record.id,
      email: record.email,
      orgId: record.orgId,
      role: record.role,
      createdAt: record.createdAt,
    };

    const token = jwt.sign(
      { sub: user.id, email: user.email, orgId: user.orgId, role: user.role },
      this.jwtSecret,
      { expiresIn: TOKEN_TTL_SECONDS, jwtid: uuidv4() },
    );

    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
    logger.info('User logged in', { userId: user.id, email: user.email });
    return { token, expiresAt, user };
  }

  async verifyToken(token: string): Promise<User> {
    const payload = jwt.verify(token, this.jwtSecret) as {
      sub: string;
      email: string;
      orgId: string;
      role: 'admin' | 'member';
    };

    const user = await this.userRepo.findById(payload.sub);
    if (!user) throw new Error('User not found');
    return user;
  }

  async refresh(token: string): Promise<AuthSession> {
    const user = await this.verifyToken(token);

    const newToken = jwt.sign(
      { sub: user.id, email: user.email, orgId: user.orgId, role: user.role },
      this.jwtSecret,
      { expiresIn: TOKEN_TTL_SECONDS, jwtid: uuidv4() },
    );
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
    return { token: newToken, expiresAt, user };
  }

  async bootstrapIfEmpty(
    email: string,
    password: string,
    orgId: string,
  ): Promise<void> {
    if (!email || !password) return;
    const total = await this.userRepo.count();
    if (total > 0) return;

    await this.register(email, password, orgId, 'admin');
    logger.info('Bootstrap admin created', { email, orgId });
  }

  async listUsers(orgId: string): Promise<User[]> {
    return this.userRepo.findAll(orgId);
  }

  async deleteUser(id: string, orgId: string): Promise<void> {
    // NotFoundError fires for both: user doesn't exist AND user belongs to
    // another org. The caller cannot distinguish the two cases — by design.
    const deleted = await this.userRepo.delete(id, orgId);
    if (!deleted) throw new NotFoundError('User not found');
  }
}
