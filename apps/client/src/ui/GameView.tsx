import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';

export function GameView({ mode }: { mode: 'solo' | 'online' }) {
  const container = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let game: Game | null = null;
    let cancelled = false;
    Game.create(container.current!, mode)
      .then((g) => {
        if (cancelled) g.dispose();
        else {
          game = g;
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        if (!cancelled) setError('Could not start the 3D view. A WebGL-capable browser is required.');
      });
    return () => {
      cancelled = true;
      game?.dispose();
    };
  }, [mode]);

  return (
    <>
      <div ref={container} className="world" aria-label="Office map" />
      {(loading || error) && <div className="loading">{error ?? 'Loading the office…'}</div>}
    </>
  );
}
