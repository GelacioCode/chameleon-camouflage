import { PALETTE } from '@chameleon/shared';
import { endSession, getState, net, send, useClient } from '../session';
import { clock, seconds, useNow } from './useNow';

const PHASE_LABEL = { lobby: 'Lobby', hide: 'Hide', seek: 'Seek', round_end: 'Round over' } as const;
const NOTICE_MS = 3000;

export function Hud() {
  const now = useNow();
  const room = useClient((s) => s.room);
  const playerId = useClient((s) => s.playerId);
  const status = useClient((s) => s.status);
  const phaseEndsAt = useClient((s) => s.phaseEndsAt);
  const tagReadyAt = useClient((s) => s.tagReadyAt);
  const notice = useClient((s) => s.notice);

  const me = room?.players.find((p) => p.id === playerId);
  const phase = room?.phase ?? 'lobby';
  const seeker = me?.role === 'seeker';
  const hiding = me?.role === 'hider' && me.alive;
  const remaining = room?.players.filter((p) => p.role === 'hider' && p.alive).length ?? 0;
  const inRound = phase === 'hide' || phase === 'seek';
  const cooldown = Math.max(0, tagReadyAt - now);
  const canPaint = phase === 'lobby' || (phase === 'hide' && hiding);

  return (
    <>
      {phase !== 'lobby' && (
        <div className="hud-top">
          <span className="phase">{PHASE_LABEL[phase]}</span>
          {inRound && <span className="timer">{clock(phaseEndsAt - now)}</span>}
          <span className="meta">
            Round {room?.round}/{room?.settings.rounds}
            {inRound && ` · ${remaining} hiding`}
          </span>
        </div>
      )}

      <div className="hud-corner top-right">
        <ConnectionChip status={status} />
        <button className="btn small" onClick={() => endSession()}>
          Leave
        </button>
      </div>

      {inRound && me && (
        <div className="role-banner">
          {seeker && 'You are the seeker. Click to tag hiders.'}
          {hiding && (phase === 'hide' ? 'Hide and pick a colour that blends in.' : 'Stay still. Colours are locked.')}
          {!seeker && !hiding && 'Spectating. Fly around with WASD.'}
        </div>
      )}

      {seeker && phase === 'seek' && (
        <>
          <div className="crosshair" />
          <div className="cooldown" aria-label="Tag cooldown">
            <div style={{ width: `${Math.min(100, (cooldown / 2000) * 100)}%` }} />
          </div>
        </>
      )}

      {seeker && phase === 'hide' && (
        <div className="blindfold">
          <h2>Eyes closed</h2>
          <p>Hiders are hiding. You're released in {seconds(phaseEndsAt - now)}s.</p>
        </div>
      )}

      {canPaint && me && (
        <div className="palette" role="group" aria-label="Body colour">
          {PALETTE.map((color, i) => (
            <button
              key={color}
              className={i === me.color ? 'swatch active' : 'swatch'}
              style={{ background: color }}
              aria-label={`Colour ${i + 1}`}
              title={`Key ${i < 9 ? i + 1 : ['0', '-', '='][i - 9]}`}
              onClick={() => send({ t: 'appearance', color: i })}
            />
          ))}
        </div>
      )}

      {notice && now - notice.at < NOTICE_MS && <div className="notice">{notice.text}</div>}

      <p className="hint">Click to look · WASD move · Shift run · Esc frees the mouse · 1–0 − = colours</p>
    </>
  );
}

function ConnectionChip({ status }: { status: ReturnType<typeof getState>['status'] }) {
  useNow(1000);
  const label =
    status === 'open'
      ? net.rtt !== null
        ? `${Math.round(net.rtt)} ms`
        : 'Connected'
      : status === 'reconnecting'
        ? 'Reconnecting…'
        : status === 'connecting'
          ? 'Connecting…'
          : 'Disconnected';
  return <span className={`chip ${status}`}>{label}</span>;
}
