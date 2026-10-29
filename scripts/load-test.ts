import { parseArgs } from 'node:util';
import { WebSocket } from 'ws';
import { BUILD_ID, BUTTON, TICK_MS, type ClientMessage, type ServerMessage } from '@chameleon/shared';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'ws://127.0.0.1:3101/ws' },
    origin: { type: 'string', default: 'http://localhost:5173' },
    players: { type: 'string', default: '8' },
    minutes: { type: 'string', default: '1' },
    start: { type: 'boolean', default: true },
  },
});

const players = Number(values.players);
const durationMs = Number(values.minutes) * 60_000;
if (!Number.isInteger(players) || players < 1 || !(durationMs > 0)) {
  console.error('usage: npm run load:test -- --url ws://host/ws --players 8 --minutes 1 [--origin https://...]');
  process.exit(1);
}

interface Bot {
  ws: WebSocket;
  id: string | null;
  seq: number;
  rtts: number[];
  snapshots: number;
  lastAck: number;
  closed: boolean;
}

const pingSent = new Map<string, number>();
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
};

function connect(index: number, onMessage: (bot: Bot, msg: ServerMessage) => void): Promise<Bot> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(values.url!, { origin: values.origin });
    const bot: Bot = { ws, id: null, seq: 0, rtts: [], snapshots: 0, lastAck: 0, closed: false };
    ws.on('open', () => resolve(bot));
    ws.on('error', reject);
    ws.on('close', () => (bot.closed = true));
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      if (msg.t === 'pong') {
        const key = `${index}:${msg.id}`;
        const sent = pingSent.get(key);
        if (sent) bot.rtts.push(performance.now() - sent);
        pingSent.delete(key);
      }
      if (msg.t === 'snapshot') {
        bot.snapshots++;
        bot.lastAck = msg.ack;
      }
      onMessage(bot, msg);
    });
  });
}

const send = (bot: Bot, msg: ClientMessage) => bot.ws.readyState === WebSocket.OPEN && bot.ws.send(JSON.stringify(msg));

let code = '';
const welcomed = new Promise<void>((resolve) => {
  void (async () => {
    const host = await connect(0, (bot, msg) => {
      if (msg.t === 'welcome') {
        bot.id = msg.playerId;
        code = msg.code;
        resolve();
      }
    });
    send(host, { t: 'create_room', nickname: 'bot-0', build: BUILD_ID });
    bots.push(host);
  })();
});

const bots: Bot[] = [];
await welcomed;
for (let i = 1; i < players; i++) {
  const bot = await connect(i, (b, msg) => msg.t === 'welcome' && (b.id = msg.playerId));
  send(bot, { t: 'join_room', code, nickname: `bot-${i}`, build: BUILD_ID });
  bots.push(bot);
}
console.log(`room ${code}: ${bots.length} bots connected to ${values.url}`);

if (values.start && players >= 2) {
  bots.slice(1).forEach((b) => send(b, { t: 'ready', ready: true }));
  setTimeout(() => send(bots[0]!, { t: 'start' }), 500);
}

const started = performance.now();
const moves = [BUTTON.forward, BUTTON.forward | BUTTON.left, BUTTON.forward | BUTTON.right, BUTTON.back, 0];
// Send at the real 20 Hz like a browser's fixed-step loop, regardless of timer granularity.
let inputsSent = 0;
const inputTimer = setInterval(() => {
  const t = performance.now() - started;
  for (; inputsSent < Math.floor(t / TICK_MS); inputsSent++) {
    bots.forEach((bot, i) => {
      const buttons = moves[Math.floor(t / 2000 + i) % moves.length]!;
      send(bot, { t: 'input', seq: ++bot.seq, buttons, yaw: Math.sin(t / 3000 + i) * Math.PI, pitch: 0 });
    });
  }
}, TICK_MS / 2);

let pingId = 0;
const pingTimer = setInterval(() => {
  pingId++;
  bots.forEach((bot, i) => {
    pingSent.set(`${i}:${pingId}`, performance.now());
    send(bot, { t: 'ping', id: pingId });
  });
}, 1000);

const report = () => {
  const rtts = bots.flatMap((b) => b.rtts);
  const elapsed = (performance.now() - started) / 1000;
  const snaps = bots.reduce((s, b) => s + b.snapshots, 0);
  const lag = bots.map((b) => b.seq - b.lastAck);
  console.log(
    `${elapsed.toFixed(0)}s  rtt p50 ${percentile(rtts, 50).toFixed(1)}ms p95 ${percentile(rtts, 95).toFixed(1)}ms  ` +
      `snapshots/bot/s ${(snaps / bots.length / elapsed).toFixed(1)}  max unacked ${Math.max(...lag)}  ` +
      `closed ${bots.filter((b) => b.closed).length}`,
  );
};
const reportTimer = setInterval(report, 10_000);

setTimeout(() => {
  clearInterval(inputTimer);
  clearInterval(pingTimer);
  clearInterval(reportTimer);
  report();
  const failed = bots.some((b) => b.closed);
  bots.forEach((b) => b.ws.close());
  process.exit(failed ? 1 : 0);
}, durationMs);
