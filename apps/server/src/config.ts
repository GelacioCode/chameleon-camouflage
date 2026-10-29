import { SETTINGS_LIMITS } from '@chameleon/shared';

export interface Config {
  host: string;
  port: number;
  allowedOrigins: string[];
  maxRoomPlayers: number;
  maxConnectionsPerIp: number;
  trustProxy: boolean;
  production: boolean;
}

const DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function int(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const origins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  for (const origin of origins) {
    if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error(`ALLOWED_ORIGINS has an invalid origin: ${origin}`);
  }
  if (production && origins.length === 0) throw new Error('ALLOWED_ORIGINS is required in production');

  return {
    host: env.HOST || '127.0.0.1',
    port: int(env, 'PORT', 3101, 0, 65535),
    allowedOrigins: origins.length ? origins : DEV_ORIGINS,
    maxRoomPlayers: int(env, 'MAX_ROOM_PLAYERS', 8, 2, SETTINGS_LIMITS.maxPlayers[1]),
    maxConnectionsPerIp: int(env, 'MAX_CONNECTIONS_PER_IP', 12, 1, 1000),
    trustProxy: env.TRUST_PROXY !== 'false',
    production,
  };
}
