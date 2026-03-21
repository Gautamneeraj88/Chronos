import path from 'path';
import dotenv from 'dotenv';

// Load .env.test before any test file runs
// This runs before each test worker starts
dotenv.config({
  path: path.resolve(__dirname, '../../.env.test'),
});
