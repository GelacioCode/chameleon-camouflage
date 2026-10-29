import type { RoundEnd } from '../session';
import { useClient } from '../session';
import { seconds, useNow } from './useNow';

const REASONS: Record<string, string> = {
  time: 'Time ran out with hiders still standing.',
  all_tagged: 'Every hider was tagged.',
  seeker_left: 'The seeker left the room.',
};

export function Results({ result }: { result: RoundEnd }) {
  const now = useNow();
  const phaseEndsAt = useClient((s) => s.phaseEndsAt);
  const playerId = useClient((s) => s.playerId);
  const rows = [...result.players].sort((a, b) => b.tags * 2 + b.survived * 3 - (a.tags * 2 + a.survived * 3));

  return (
    <div className="panel results" role="dialog" aria-label="Round results">
      <span className="eyebrow">
        Round {result.round}
        {result.matchOver && ' · Final'}
      </span>
      <h2>{result.winner === 'seekers' ? 'Seekers win' : 'Hiders win'}</h2>
      <p className="muted">{REASONS[result.reason] ?? ''}</p>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Role</th>
            <th>Tags</th>
            <th>Survived</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={p.id === playerId ? 'me' : ''}>
              <td>{p.nickname}</td>
              <td>{p.role === 'hider' ? (p.alive ? 'Hider' : 'Tagged') : p.role === 'seeker' ? 'Seeker' : 'Watching'}</td>
              <td>{p.tags}</td>
              <td>{p.survived}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        {result.matchOver ? 'Back to the lobby' : 'Next round'} in {seconds(phaseEndsAt - now)}s
      </p>
    </div>
  );
}
