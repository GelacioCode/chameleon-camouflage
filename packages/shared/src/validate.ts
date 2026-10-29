import {
  BUTTON_MASK,
  MAX_MESSAGE_BYTES,
  NICKNAME_MAX,
  PALETTE,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SETTINGS_LIMITS,
  type RoomSettings,
} from './constants';
import type { ClientMessage } from './protocol';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isAngle = (v: unknown): v is number => isFiniteNum(v) && Math.abs(v) <= 1000;
const isBuild = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

const codePattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export function normalizeNickname(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return name.length >= 1 && name.length <= NICKNAME_MAX ? name : null;
}

export function normalizeRoomCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const code = v.trim().toUpperCase();
  return codePattern.test(code) ? code : null;
}

export function parseSettings(v: unknown): RoomSettings | null {
  if (!isObj(v)) return null;
  const out = {} as RoomSettings;
  for (const key of Object.keys(SETTINGS_LIMITS) as (keyof RoomSettings)[]) {
    const [min, max] = SETTINGS_LIMITS[key];
    const value = v[key];
    if (!isInt(value, min, max)) return null;
    out[key] = value;
  }
  return out;
}

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(m) || typeof m.t !== 'string') return null;

  switch (m.t) {
    case 'create_room': {
      const nickname = normalizeNickname(m.nickname);
      if (!nickname || !isBuild(m.build)) return null;
      return { t: 'create_room', nickname, build: m.build };
    }
    case 'join_room': {
      const nickname = normalizeNickname(m.nickname);
      const code = normalizeRoomCode(m.code);
      if (!nickname || !code || !isBuild(m.build)) return null;
      const msg: ClientMessage = { t: 'join_room', code, nickname, build: m.build };
      if (m.reconnectToken !== undefined) {
        if (typeof m.reconnectToken !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(m.reconnectToken)) return null;
        msg.reconnectToken = m.reconnectToken;
      }
      return msg;
    }
    case 'leave':
    case 'start':
      return { t: m.t };
    case 'ready':
      return typeof m.ready === 'boolean' ? { t: 'ready', ready: m.ready } : null;
    case 'host_settings': {
      const settings = parseSettings(m.settings);
      return settings ? { t: 'host_settings', settings } : null;
    }
    case 'input':
      if (!isInt(m.seq, 0, 2 ** 31) || !isInt(m.buttons, 0, BUTTON_MASK) || !isAngle(m.yaw) || !isAngle(m.pitch))
        return null;
      return { t: 'input', seq: m.seq, buttons: m.buttons, yaw: m.yaw, pitch: m.pitch };
    case 'appearance':
      return isInt(m.color, 0, PALETTE.length - 1) ? { t: 'appearance', color: m.color } : null;
    case 'tag':
      return isAngle(m.yaw) && isAngle(m.pitch) ? { t: 'tag', yaw: m.yaw, pitch: m.pitch } : null;
    case 'ping':
      return isInt(m.id, 0, 2 ** 31) ? { t: 'ping', id: m.id } : null;
    default:
      return null;
  }
}
