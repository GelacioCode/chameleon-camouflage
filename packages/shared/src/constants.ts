export const PROTOCOL_VERSION = 1;

export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;
export const TICK_DT = 1 / TICK_RATE;
export const SNAPSHOT_EVERY_TICKS = 2;
export const INTERP_DELAY_MS = 150;
export const MAX_BANKED_INPUTS = 4;

export const WALK_SPEED = 2;
export const SPRINT_SPEED = 3.6;
export const MAX_MOVE_STEP = 0.1;
export const PITCH_LIMIT = 1.15;

// Movement radius is limited by the 0.47 m gap between facing chairs.
export const PLAYER_RADIUS = 0.2;
export const BODY_MIN_Y = 0.05;
export const BODY_HEIGHT = 1.2;
export const HIT_RADIUS = 0.28;
export const SEEKER_EYE = 1.6;
export const HIDER_EYE = 1.0;

export const TAG_RANGE = 6;
export const TAG_COOLDOWN_MS = 650;
export const MISS_COOLDOWN_MS = 2000;

export const ROUND_END_MS = 6000;
export const RECONNECT_GRACE_MS = 30_000;
export const EMPTY_ROOM_TTL_MS = 120_000;

export const MAX_MESSAGE_BYTES = 4096;
export const NICKNAME_MAX = 16;
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const BUTTON = {
  forward: 1,
  back: 2,
  left: 4,
  right: 8,
  sprint: 16,
} as const;
export const BUTTON_MASK = 31;

export interface RoomSettings {
  rounds: number;
  hideSeconds: number;
  seekSeconds: number;
  maxPlayers: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 3,
  hideSeconds: 30,
  seekSeconds: 180,
  maxPlayers: 8,
};

export const SETTINGS_LIMITS: Record<keyof RoomSettings, [number, number]> = {
  rounds: [1, 10],
  hideSeconds: [10, 120],
  seekSeconds: [30, 600],
  maxPlayers: [2, 30],
};

// Sampled from the office map materials.
export const PALETTE = [
  '#777a77', // carpet
  '#c6ac87', // oak desk
  '#d53337', // column
  '#f2f0e6', // wall
  '#e9e8e1', // trim
  '#7e8d90', // privacy screen
  '#272e2e', // chair
  '#10181b', // screen off
  '#aab0ad', // monitor stand
  '#dfdfd7', // ceiling
  '#4e7658', // plant
  '#755534', // frame
] as const;
