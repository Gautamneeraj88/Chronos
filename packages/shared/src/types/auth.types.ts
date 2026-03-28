export interface User {
  id: string;
  email: string;
  orgId: string;
  role: 'admin' | 'member';
  createdAt: Date;
}

export interface AuthSession {
  token: string;
  expiresAt: string; // ISO
  user: User;
}
