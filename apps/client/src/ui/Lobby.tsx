import { useState } from 'react';
import { PALETTE, type RoomSettings } from '@chameleon/shared';
import { send, useClient } from '../session';

const OPTIONS: Record<keyof RoomSettings, number[]> = {
  rounds: [1, 2, 3, 4, 5, 6, 8, 10],
  hideSeconds: [15, 20, 30, 45, 60, 90, 120],
  seekSeconds: [60, 90, 120, 180, 240, 300, 420, 600],
  maxPlayers: [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 30],
};
const LABELS: Record<keyof RoomSettings, string> = {
  rounds: 'Rounds',
  hideSeconds: 'Hide time (s)',
  seekSeconds: 'Seek time (s)',
  maxPlayers: 'Max players',
};

export function Lobby() {
  const room = useClient((s) => s.room)!;
  const playerId = useClient((s) => s.playerId);
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === playerId;
  const me = room.players.find((p) => p.id === playerId);
  const connected = room.players.filter((p) => p.connected);
  const canStart = connected.length >= 2 && connected.every((p) => p.ready || p.id === room.hostId);

  const link = `${location.origin}/?room=${room.code}`;
  const copy = () => {
    navigator.clipboard?.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };

  const update = (key: keyof RoomSettings, value: number) =>
    send({ t: 'host_settings', settings: { ...room.settings, [key]: value } });

  return (
    <aside className="panel lobby" aria-label="Lobby">
      <header>
        <div>
          <span className="eyebrow">Room code</span>
          <h2 className="code">{room.code}</h2>
        </div>
        <button className="btn small" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </header>

      <ul className="roster">
        {room.players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'away'}>
            <span className="dot" style={{ background: PALETTE[p.color] }} />
            <span className="name">
              {p.nickname}
              {p.id === playerId && ' (you)'}
            </span>
            {p.id === room.hostId ? (
              <span className="tag">Host</span>
            ) : (
              <span className={p.ready ? 'tag ok' : 'tag'}>{p.ready ? 'Ready' : 'Not ready'}</span>
            )}
          </li>
        ))}
      </ul>

      <div className="settings">
        {(Object.keys(OPTIONS) as (keyof RoomSettings)[]).map((key) => (
          <label key={key}>
            {LABELS[key]}
            <select disabled={!isHost} value={room.settings[key]} onChange={(e) => update(key, Number(e.target.value))}>
              {[...new Set([...OPTIONS[key], room.settings[key]])]
                .sort((a, b) => a - b)
                .map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>

      {isHost ? (
        <button className="btn primary" disabled={!canStart} onClick={() => send({ t: 'start' })}>
          Start match
        </button>
      ) : (
        <button className="btn primary" onClick={() => send({ t: 'ready', ready: !me?.ready })}>
          {me?.ready ? 'Not ready' : 'Ready'}
        </button>
      )}
      {isHost && !canStart && <p className="muted">Waiting for at least 2 players, all ready.</p>}
      <p className="muted">Walk around while you wait. Pick a colour below.</p>
    </aside>
  );
}
