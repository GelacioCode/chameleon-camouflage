import { GameView } from './ui/GameView';
import { Hud } from './ui/Hud';
import { Landing } from './ui/Landing';
import { Lobby } from './ui/Lobby';
import { Results } from './ui/Results';
import { setState, useClient } from './session';

export function App() {
  const screen = useClient((s) => s.screen);
  const phase = useClient((s) => s.room?.phase);
  const roundEnd = useClient((s) => s.roundEnd);

  if (screen === 'solo') {
    return (
      <>
        <GameView mode="solo" />
        <div className="hud-corner top-right">
          <button className="btn small" onClick={() => setState({ screen: 'landing' })}>
            Back
          </button>
        </div>
        <p className="hint">Click to look · WASD/arrows move · Shift run · Esc releases the mouse</p>
      </>
    );
  }

  if (screen === 'room') {
    return (
      <>
        <GameView mode="online" />
        <Hud />
        {phase === 'lobby' && <Lobby />}
        {roundEnd && phase === 'round_end' && <Results result={roundEnd} />}
      </>
    );
  }

  return <Landing />;
}
