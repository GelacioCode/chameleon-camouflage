# Office Camouflage

Browser multiplayer hide-and-seek set in our office. Hiders pick colours that blend into the floor, desks and walls; a seeker hunts them down before the clock runs out.

The server is authoritative: clients send inputs, the server simulates movement, resolves tags and owns every phase transition. Clients predict their own movement with the same code and reconcile against server acks.

## Stack

- **Client:** Vite, React for UI, Three.js for the scene
- **Server:** Node.js + `ws`, a single process with in-memory rooms
- **Shared:** protocol types, input validation, collision, movement and raycasting used by both sides
- **Map:** office v6 (floor-plan layout, 344 colliders, 12 paintings, 150 monitors)

```
apps/client      browser game
apps/server      room server (bundled to dist/index.js)
packages/shared  protocol, simulation, map data
scripts          map validation, load test
deploy           nginx + systemd examples
```

## Local development

Node 20.19+ (22 LTS or 24 recommended).

```bash
npm install
npm run dev          # server on :3101, client on http://localhost:5173
```

Open two browser windows, create a room in one and join with the code (or the copied link) in the other. No `.env` is needed locally.

| Script | |
|---|---|
| `npm run typecheck` | TypeScript across all workspaces |
| `npm test` | Unit tests plus a full round over real websockets |
| `npm run validate:map` | Spawns and route checked against the collision model |
| `npm run build` | `apps/client/dist` and `apps/server/dist/index.js` |
| `npm run load:test -- --players 8 --minutes 1` | Bot clients against a running server (`--url`, `--origin` to target the VPS) |

## How a match plays

1. The host creates a room and shares the code. Everyone else readies up, and the host starts.
2. **Hide** (30 s default): hiders move and change colour with keys `1`–`0`, `-`, `=` or the palette. The seeker is blindfolded and frozen, and receives no hider positions.
3. **Seek** (180 s default): colours lock. The seeker clicks to tag, with 6 m range and line of sight. A miss costs a 2 s cooldown.
4. The seekers win when every hider is tagged. The hiders win if anyone is still standing at the buzzer.
5. The seeker role rotates each round. After the last round the room returns to the lobby.

Controls: click to capture the mouse (Esc releases; drag-to-look also works), WASD/arrows to move, Shift to run.

Rooms live in memory. Restarting the server ends active matches, so deploy between games. Disconnected players keep their slot for 30 s and resume on reload.

## Configuration

Server settings come from the environment. See `.env.example`.

| Variable | Default | |
|---|---|---|
| `HOST` | `127.0.0.1` | Keep on loopback behind nginx |
| `PORT` | `3101` | |
| `ALLOWED_ORIGINS` | localhost:5173 | Comma-separated, required in production; checked on every websocket upgrade |
| `MAX_ROOM_PLAYERS` | `8` | Upper bound for the host's player-limit setting |
| `MAX_CONNECTIONS_PER_IP` | `32` | Office NATs share an address |
| `TRUST_PROXY` | `true` | Read `X-Real-IP` from a loopback proxy |

The client connects to `/ws` on its own origin. Set `VITE_WS_URL` at build time only if the server lives elsewhere.

## Deploying to the VPS

The client and server share one subdomain. Nginx serves `apps/client/dist` and proxies `/ws` and `/api/` to the Node process. Replace `play.example.com` below with the real subdomain.

**0. Look first.** The box already runs Paint Rush. Confirm port 3101 is free and see how nginx is set up:

```bash
sudo ss -tlnp
sudo nginx -T 2>/dev/null | grep -E 'server_name|listen|proxy_pass'
systemctl list-units --type=service --state=running
node -v    # needs 20.19+, installed system-wide (not under /root/.nvm)
```

If 3101 is taken, choose another port and use it in both `server.env` and the nginx file.

**1. DNS.** Add an A record for `play.example.com` pointing to `187.127.114.35`.

**2. User and checkout**

```bash
sudo useradd --system --create-home --home-dir /var/lib/chameleon --shell /usr/sbin/nologin chameleon
sudo git clone https://github.com/GelacioCode/chameleon-camouflage.git /srv/chameleon
sudo chown -R chameleon:chameleon /srv/chameleon
cd /srv/chameleon
sudo -u chameleon -H npm ci
sudo -u chameleon -H npm test
sudo -u chameleon -H npm run build
```

If the repository is private, add a read-only deploy key or clone with a token.

**3. Environment**

```bash
sudo mkdir -p /etc/chameleon
sudo cp .env.example /etc/chameleon/server.env
sudo sed -i 's#https://GAME_DOMAIN#https://play.example.com#' /etc/chameleon/server.env
sudo chown root:chameleon /etc/chameleon/server.env
sudo chmod 640 /etc/chameleon/server.env
```

**4. Service**

```bash
sudo cp deploy/chameleon.service.example /etc/systemd/system/chameleon.service
command -v node    # if this isn't /usr/bin/node, update ExecStart
sudo systemctl daemon-reload
sudo systemctl enable --now chameleon
systemctl status chameleon --no-pager
curl -s http://127.0.0.1:3101/api/health
```

**5. Nginx and TLS**

```bash
sudo cp deploy/nginx-chameleon.conf.example /etc/nginx/sites-available/chameleon
sudo sed -i 's/GAME_DOMAIN/play.example.com/' /etc/nginx/sites-available/chameleon
sudo ln -s /etc/nginx/sites-available/chameleon /etc/nginx/sites-enabled/chameleon
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d play.example.com
curl -s https://play.example.com/api/health
```

Don't open 3101 in any firewall; only nginx should reach it.

**Updating**

```bash
cd /srv/chameleon
sudo -u chameleon -H git pull
sudo -u chameleon -H npm ci
sudo -u chameleon -H npm run build
sudo systemctl restart chameleon
```

To roll back, `git checkout <previous-sha>`, then rebuild and restart. Clients running an older build are told to reload, because the build ID is checked on join.

Logs: `journalctl -u chameleon -n 100 --no-pager`.

## Known limits

- Tested with 8 bots locally. Raise `MAX_ROOM_PLAYERS` toward 20–30 only after a load test on the VPS and real-browser FPS checks on the office laptops.
- All players in view are replicated to every client during seek, so a modified client could reveal hider positions.
- Desk privacy screens and chairs don't block tags. Walls, glass, desks and columns do.
- WebGL is required. Touch controls, the paint editor, poses and surface-blend camouflage aren't built yet.
- Map scale is traced from a floor-plan screenshot, not a survey.

## Credits

Three.js is MIT-licensed. Artwork reproductions and wallpaper images are listed with sources and rights notes in `apps/client/public/maps/office/asset-sources.json`. Third-party images are not covered by this project's code license.
