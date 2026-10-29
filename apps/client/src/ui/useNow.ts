import { useEffect, useState } from 'react';

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const seconds = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export const clock = (ms: number) => {
  const s = seconds(ms);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
