import { env } from './config/env.ts';

const LEVEL_BY_ENV = {
  production: 'info',
  development: 'debug',
  test: 'silent',
} as const;

export const loggerOptions = {
  level: LEVEL_BY_ENV[env.NODE_ENV],
  // ponytail: pino-pretty hanya di development; transport worker menggantung di `bun test`.
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } } }
    : {}),
};
