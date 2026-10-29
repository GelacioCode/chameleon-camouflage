import type { RoomSettings } from './constants';

export type Phase = 'lobby' | 'hide' | 'seek' | 'round_end';
export type Role = 'hider' | 'seeker' | 'spectator';
export type Winner = 'hiders' | 'seekers';

export type ClientMessage =
  | { t: 'create_room'; nickname: string; build: string }
  | { t: 'join_room'; code: string; nickname: string; build: string; reconnectToken?: string }
  | { t: 'leave' }
  | { t: 'ready'; ready: boolean }
  | { t: 'host_settings'; settings: RoomSettings }
  | { t: 'start' }
  | { t: 'input'; seq: number; buttons: number; yaw: number; pitch: number }
  | { t: 'appearance'; color: number }
  | { t: 'tag'; yaw: number; pitch: number }
  | { t: 'ping'; id: number };

export interface PlayerInfo {
  id: string;
  nickname: string;
  ready: boolean;
  role: Role;
  alive: boolean;
  connected: boolean;
  color: number;
  tags: number;
  survived: number;
}

export interface PlayerState {
  id: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export type ServerMessage =
  | { t: 'welcome'; playerId: string; code: string; reconnectToken: string }
  | {
      t: 'room_state';
      code: string;
      hostId: string;
      phase: Phase;
      round: number;
      settings: RoomSettings;
      players: PlayerInfo[];
    }
  | {
      t: 'snapshot';
      tick: number;
      phase: Phase;
      phaseEndsIn: number;
      ack: number;
      players: PlayerState[];
    }
  | { t: 'tag_result'; seekerId: string; hitId: string | null; cooldownMs: number }
  | {
      t: 'round_end';
      winner: Winner;
      reason: string;
      round: number;
      matchOver: boolean;
      nextIn: number;
      players: PlayerInfo[];
    }
  | { t: 'pong'; id: number }
  | { t: 'error'; code: ErrorCode; message: string };

export type ErrorCode =
  | 'bad_message'
  | 'rate_limited'
  | 'room_not_found'
  | 'room_full'
  | 'incompatible_build'
  | 'not_host'
  | 'cannot_start'
  | 'not_in_room';
