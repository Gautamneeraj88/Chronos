import { Schema, model, Document } from 'mongoose';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  orgId: string;
  role: 'admin' | 'member';
  createdAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    orgId:        { type: String, required: true, index: true },
    role:         { type: String, enum: ['admin', 'member'], default: 'member' },
    createdAt:    { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export const UserModel = model<UserDocument>('User', UserSchema);
