import { randomInt } from 'node:crypto';
import { EMPTY_ROOM_TTL_MS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@chameleon/shared';
import { Room, type RoomOptions } from './Room';

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  constructor(private readonly opts: RoomOptions) {}

  create(): Room {
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, this.opts);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  update(): void {
    for (const [code, room] of this.rooms) {
      room.update();
      if (room.isExpired(EMPTY_ROOM_TTL_MS)) this.rooms.delete(code);
    }
  }

  stats() {
    let players = 0;
    for (const room of this.rooms.values()) players += room.connectedCount;
    return { rooms: this.rooms.size, players };
  }
}
