import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET ?? 'dev_secret_must_be_16_chars_min';
const token = jwt.sign(
  { userId: 'dev-user-001', email: 'dev@chronos.local' },
  secret,
  { expiresIn: '7d' }
);

console.log('Bearer ' + token);
