import dotenv from 'dotenv';
dotenv.config({ override: process.env.NODE_ENV !== 'production' });

const required = ['MONGO_URI'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}
