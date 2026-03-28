import { User } from '@chronos/shared';
import { UserModel } from '../models/user.model';
import { IUserRepository } from './IUserRepository';

function toUser(doc: { _id: unknown; email: string; orgId: string; role: string; createdAt: Date }): User {
  return {
    id: String(doc._id),
    email: doc.email,
    orgId: doc.orgId,
    role: doc.role as 'admin' | 'member',
    createdAt: doc.createdAt,
  };
}

export class MongoUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (!doc) return null;
    return { ...toUser(doc), passwordHash: doc.passwordHash };
  }

  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id).lean();
    if (!doc) return null;
    return toUser(doc);
  }

  async save(data: {
    email: string;
    passwordHash: string;
    orgId: string;
    role: 'admin' | 'member';
  }): Promise<User> {
    const doc = await UserModel.create(data);
    return toUser(doc.toObject());
  }

  async count(): Promise<number> {
    return UserModel.countDocuments();
  }

  async findAll(orgId: string): Promise<User[]> {
    const docs = await UserModel.find({ orgId }).lean();
    return docs.map(toUser);
  }

  async delete(id: string): Promise<void> {
    await UserModel.findByIdAndDelete(id);
  }
}
