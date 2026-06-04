import dotenv from 'dotenv';
dotenv.config({ override: true });

const required = ['MONGO_URI'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}
