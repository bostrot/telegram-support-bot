# AGENTS.md — telegram-support-bot

## Quick start

```bash
cp config/config-sample.yaml config/config.yaml   # create config (edit bot_token, staffchat_id, owner_id)
npm install
docker compose up -d mongodb                       # MongoDB is required at runtime
npm run dev                                        # ts-node-dev hot-reload loop
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Development server via `ts-node-dev` (watch + restart) |
| `npm run build` or `npm run tsc` | Compile TypeScript → `build/` |
| `npm run prod` | Run compiled JS (`node ./build/index.js`) — requires prior `npm run build` |
| `npm test` | Run Jest suite (always uses `--detectOpenHandles --forceExit --runInBand`) |

There is **no** lint or format script in `package.json`. ESLint config exists at `.eslintrc.yml` but must be invoked manually: `npx eslint src/`.

## Running the bot

### 1. Direct (npm)
```bash
cp config/config-sample.yaml config/config.yaml   # edit bot_token, staffchat_id, owner_id
npm install
docker compose up -d mongodb                       # MongoDB is required at runtime
npm run build && npm run prod                      # compile and start
# or for development with hot-reload:
npm run dev
```

### 2. Docker Compose (full stack)
```bash
cp config/config-sample.yaml config/config.yaml   # edit bot_token, staffchat_id, owner_id
docker compose up -d                               # builds image + starts bot + MongoDB (+ optional signal-cli, mongo-express)
docker compose logs -f supportbot                  # view bot logs
```

### 3. Tests (local — no DB needed)
Tests mock all external dependencies (MongoDB, Telegram API, config). No running services required:
```bash
npm install && npm test                            # run full suite (10 suites, 68 tests)
npm test -- test/cache.test.ts                     # single file
npm test -- -t "test name"                         # specific test case
```

## Config

- Runtime config lives in `config/config.yaml` (YAML, not JSON).
- File is loaded synchronously on startup via `src/cache.ts`; it **must exist** before the bot runs.
- Copy from `config/config-sample.yaml`, then edit at minimum: `bot_token`, `staffchat_id`, `owner_id`.
- The sample token `YOUR_BOT_TOKEN` causes a hard exit — never commit a real token.

## Architecture

- **Entry point**: `src/index.ts` → connects MongoDB, runs SQLite→Mongo migration if needed, then starts addons.
- **Addon system** (`src/addons/`): Each platform (Telegram, Signal) is an addon implementing the `Addon` interface from `src/interfaces.ts`. Telegram lives in `addons/telegram/index.ts`, Signal in `addons/signal/`.
- **Database**: MongoDB via Mongoose (`src/db.ts`). Collection name is derived from `owner_id` + last 5 chars of bot token.
- **Config cache** (`src/cache.ts`): Singleton that parses YAML config at module load time. Tests mock this module entirely.

## Testing

- Framework: Jest + ts-jest, Node environment.
- Setup files run before every test: `jest.setup.js` (mocks `fancy-log`, `openai`) and `test/mocks.ts` (mocks `cache`, `db`, `grammy`, `axios`, `ws`).
- Tests do **not** need a real MongoDB or config file — everything is mocked.
- Run single test: `npm test -- path/to/file.test.ts` or with `-t "test name"` for a specific case.

## TypeScript quirks

- `strictNullChecks` is **disabled** in `tsconfig.json`. Code may rely on loose null handling.
- Module system: `Node16` resolution, target ES2022.
- Build output directory: `build/`. The compiled entry is `build/index.js` (package `"main"` field).

## Docker / deployment

- `docker-compose.yml` provides 4 services: bot, MongoDB, signal-cli REST API, mongo-express web UI.
- Bot mounts `./config:/bot/config` so the YAML config is available inside the container.
- `MONGO_URI` env var points to `mongodb://mongodb:27017/support`.
- Dockerfile is multi-stage (node:22-alpine), requires `python3` + `build-base` for native modules (`better-sqlite3`).
- All non-bot ports are bound to `127.0.0.1` only — MongoDB, signal-cli, and mongo-express are not exposed externally.

## Dependencies worth knowing

| Package | Role |
|---|---|
| `grammy` | Telegram Bot API framework |
| `mongoose` | MongoDB ODM |
| `llamaindex` / `openai` | LLM-powered auto-reply (optional, gated by `use_llm: true`) |
| `better-sqlite3` | Optional — used only for legacy SQLite migration path |
