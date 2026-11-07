import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  // Managed Postgres (Neon, etc.) requires TLS; off by default for the local docker database.
  DATABASE_SSL: Joi.boolean().default(false),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  // Root directory of the goal photos (FR-41). Relative paths resolve against the working directory;
  // it is created on demand and git-ignored (`/storage`).
  PHOTOS_DIR: Joi.string().min(1).default('storage/photos'),
  // Where the photo bytes live: `local` disk (PHOTOS_DIR) or a Vercel `blob` store, for runtimes
  // without a writable disk. The blob store needs its read-write token.
  PHOTOS_STORAGE: Joi.string().valid('local', 'blob').default('local'),
  BLOB_READ_WRITE_TOKEN: Joi.string().when('PHOTOS_STORAGE', {
    is: 'blob',
    then: Joi.required(),
  }),
});
