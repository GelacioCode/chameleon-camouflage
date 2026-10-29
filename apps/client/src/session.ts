import { useSyncExternalStore } from 'react';
import { BUILD_ID, type ClientMessage, type ServerMessage } from '@chameleon/shared';
import { NetClient, type ConnectionStatus } from './net/socket';

export type RoomState = Extract<ServerMessage, { t: 'room_state' }>;
export type RoundEnd = Extract<ServerMessage, { t: 'round_end' }>;

export interface ClientState {
  screen: 'landing' | 'solo' | 'room';
  status: ConnectionStatus;
  playerId: string | null;
  room: RoomState | null;
  phaseEndsAt: number;
  roundEnd: RoundEnd | null;
  tagReadyAt: number;
  notice: { text: string; at: number } | null;
  error: string | null;
}

interface Session {
  code: string;
  reconnectToken: string;
  nickname: string;
}

const SESSION_KEY = 'chameleon.session';
const NICK_KEY = 'chameleon.nickname';

let state: ClientState = {
  screen: 'landing',
  status: 'idle',
  playerId: null,
  room: null,
  phaseEndsAt: 0,
  roundEnd: null,
  tagReadyAt: 0,
  notice: null,
  error: null,
};
const subscribers = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<ClientState>): void {
  state = { ...state, ...patch };
  for (const fn of subscribers) fn();
}
export function useClient<T>(select: (s: ClientState) => T): T {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => select(state),
  );
}

const storage = {
  get<T>(store: Storage, key: string): T | null {
    try {
      const raw = store.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(store: Storage, key: string, value: unknown): void {
    try {
      if (value === null) store.removeItem(key);
      else store.setItem(key, JSON.stringify(value));
    } catch {
      // Private mode or blocked storage; resume just won't survive a reload.
    }
  },
};

export const savedNickname = () => storage.get<string>(localStorage, NICK_KEY) ?? '';

export const net = new NetClient();
let intent: ClientMessage | null = null;
let session: Session | null = storage.get<Session>(sessionStorage, SESSION_KEY);
let currentNickname = savedNickname();

net.onStatus((status) => setState({ status }));
net.onOpen = () => {
  if (intent) {
    net.send(intent);
    intent = null;
  } else if (session) {
    net.send({
      t: 'join_room',
      code: session.code,
      nickname: session.nickname,
      build: BUILD_ID,
      reconnectToken: session.reconnectToken,
    });
  }
};

function nicknameOf(id: string | null): string {
  return state.room?.players.find((p) => p.id === id)?.nickname ?? 'Someone';
}

function notify(text: string): void {
  setState({ notice: { text, at: performance.now() } });
}

net.onMessage((msg) => {
  switch (msg.t) {
    case 'welcome': {
      session = { code: msg.code, reconnectToken: msg.reconnectToken, nickname: session?.nickname ?? currentNickname };
      storage.set(sessionStorage, SESSION_KEY, session);
      history.replaceState(null, '', `?room=${msg.code}`);
      setState({ screen: 'room', playerId: msg.playerId, error: null });
      return;
    }
    case 'room_state':
      setState({ room: msg, roundEnd: msg.phase === 'round_end' ? state.roundEnd : null });
      return;
    case 'snapshot': {
      const endsAt = performance.now() + msg.phaseEndsIn;
      if (Math.abs(endsAt - state.phaseEndsAt) > 250) setState({ phaseEndsAt: endsAt });
      return;
    }
    case 'tag_result':
      if (msg.seekerId === state.playerId) {
        setState({ tagReadyAt: performance.now() + msg.cooldownMs });
        notify(msg.hitId ? `Tagged ${nicknameOf(msg.hitId)}!` : 'Missed');
      } else if (msg.hitId === state.playerId) {
        notify('You were tagged. Spectating until the next round.');
      } else if (msg.hitId) {
        notify(`${nicknameOf(msg.hitId)} was tagged`);
      }
      return;
    case 'round_end':
      setState({ roundEnd: msg });
      return;
    case 'error':
      if (msg.code === 'room_not_found' || msg.code === 'incompatible_build' || msg.code === 'room_full') {
        endSession(msg.message);
      } else {
        notify(msg.message);
      }
      return;
  }
});

function begin(msg: ClientMessage, nickname: string): void {
  currentNickname = nickname;
  storage.set(localStorage, NICK_KEY, nickname);
  session = null;
  storage.set(sessionStorage, SESSION_KEY, null);
  intent = msg;
  setState({ error: null });
  if (net.status === 'open') net.onOpen?.();
  else net.connect();
}

export const createRoom = (nickname: string) => begin({ t: 'create_room', nickname, build: BUILD_ID }, nickname);
export const joinRoom = (code: string, nickname: string) =>
  begin({ t: 'join_room', code, nickname, build: BUILD_ID }, nickname);

export function resumeSession(): boolean {
  if (!session) return false;
  net.connect();
  return true;
}

export function endSession(error: string | null = null): void {
  net.send({ t: 'leave' });
  net.close();
  session = null;
  intent = null;
  storage.set(sessionStorage, SESSION_KEY, null);
  history.replaceState(null, '', location.pathname);
  setState({ screen: 'landing', room: null, playerId: null, roundEnd: null, error });
}

export const send = (msg: ClientMessage) => net.send(msg);
