import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, parseClientMessage } from '../src';

const parse = (v: unknown) => parseClientMessage(JSON.stringify(v));

describe('parseClientMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parse({ t: 'input', seq: 4, buttons: 9, yaw: 1.2, pitch: -0.3 })).toEqual({
      t: 'input',
      seq: 4,
      buttons: 9,
      yaw: 1.2,
      pitch: -0.3,
    });
    expect(parse({ t: 'join_room', code: 'abcde', nickname: '  Sam  ', build: 'x' })).toMatchObject({
      code: 'ABCDE',
      nickname: 'Sam',
    });
  });

  it('rejects unknown kinds, bad JSON and oversized payloads', () => {
    expect(parse({ t: 'teleport', x: 1 })).toBeNull();
    expect(parseClientMessage('{nope')).toBeNull();
    expect(parseClientMessage(' '.repeat(MAX_MESSAGE_BYTES + 1))).toBeNull();
  });

  it('rejects non-finite or out-of-range numbers', () => {
    expect(parseClientMessage('{"t":"input","seq":1,"buttons":0,"yaw":1e999,"pitch":0}')).toBeNull();
    expect(parse({ t: 'input', seq: 1, buttons: 64, yaw: 0, pitch: 0 })).toBeNull();
    expect(parse({ t: 'input', seq: -1, buttons: 0, yaw: 0, pitch: 0 })).toBeNull();
    expect(parse({ t: 'appearance', color: 99 })).toBeNull();
    expect(parse({ t: 'tag', yaw: 'left', pitch: 0 })).toBeNull();
  });

  it('validates room codes, nicknames and settings', () => {
    expect(parse({ t: 'join_room', code: 'AB1DE', nickname: 'x', build: 'x' })).toBeNull();
    expect(parse({ t: 'create_room', nickname: '   ', build: 'x' })).toBeNull();
    expect(parse({ t: 'create_room', nickname: 'x'.repeat(40), build: 'x' })).toBeNull();
    expect(
      parse({ t: 'host_settings', settings: { rounds: 3, hideSeconds: 5, seekSeconds: 180, maxPlayers: 8 } }),
    ).toBeNull();
  });
});
