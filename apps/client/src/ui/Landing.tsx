import { useState, type FormEvent } from 'react';
import { NICKNAME_MAX, normalizeNickname, normalizeRoomCode } from '@chameleon/shared';
import { createRoom, joinRoom, savedNickname, setState, useClient } from '../session';

export function Landing() {
  const error = useClient((s) => s.error);
  const status = useClient((s) => s.status);
  const [nickname, setNickname] = useState(savedNickname);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');

  const name = normalizeNickname(nickname);
  const roomCode = normalizeRoomCode(code);
  const busy = status === 'connecting' || status === 'reconnecting';

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (name && roomCode) joinRoom(roomCode, name);
  };

  return (
    <main className="landing">
      <div className="card">
        <h1>Office Camouflage</h1>
        <p className="lede">Paint yourself into the office. Find the people who did.</p>

        <label htmlFor="nickname">Nickname</label>
        <input
          id="nickname"
          value={nickname}
          maxLength={NICKNAME_MAX}
          autoComplete="nickname"
          onChange={(e) => setNickname(e.target.value)}
        />

        <button className="btn primary" disabled={!name || busy} onClick={() => name && createRoom(name)}>
          Create room
        </button>

        <form className="join" onSubmit={join}>
          <label htmlFor="code">Room code</label>
          <div className="row">
            <input
              id="code"
              value={code}
              maxLength={5}
              placeholder="ABCDE"
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn" type="submit" disabled={!name || !roomCode || busy}>
              Join
            </button>
          </div>
        </form>

        <button className="btn ghost" onClick={() => setState({ screen: 'solo', error: null })}>
          Explore the office solo
        </button>

        {busy && <p className="status">Connecting…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
