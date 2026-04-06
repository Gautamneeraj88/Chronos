import { User } from '@chronos/shared';

export interface IUserRepository {
  findByEmail(email: string): Promise<(User & { passwordHash: string }) | null>;
  findById(id: string): Promise<User | null>;
  save(data: { email: string; passwordHash: string; orgId: string; role: 'admin' | 'member' }): Promise<User>;
  count(): Promise<number>;
  findAll(orgId: string): Promise<User[]>;
  delete(id: string, orgId: string): Promise<boolean>;
}
