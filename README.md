# OpsMind

OpsMind is an incident-response console for production teams. It searches previously resolved incidents before making an evidence-based recommendation, requires operator approval for remediation, verifies simulated recovery, and stores a new persistent experience for the next incident.

> Production incidents aren't new. Your AI shouldn't treat them that way.

## Features

- Evidence-ranked historical memory search across actual SQLite records.
- Six incident scenarios, simulated metrics, progressive log events and incident timelines.
- Investigation plans, a service-matched runbook and a deterministic evidence-based agent.
- Backend-enforced operator approval, simulated action execution and recovery verification.
- Post-incident experience storage and retrieval in the next similar incident.
- Incident history and filtering, service health, runbooks, analytics, memory search and graph, and demo reset.
- Responsive React console with loading/error states and action feedback.

## Architecture

```text
client/ React 19 + TypeScript + Vite + Tailwind + Recharts + Lucide
server/ Express 5 + strict TypeScript + SQLite + Zod + deterministic agent
```

SQLite is the persistent system of record for incidents, incident events, memories, runbooks, services, and agent actions. The local memory provider computes similarity from service overlap, symptom overlap, and evidence keywords. An external memory integration is not called or represented as connected in the demo: the displayed provider is `Local Memory Fallback`.

## Prerequisites

- Node.js 20.19+ or 22.12+ and npm.
- Windows, macOS, or Linux.

## Install and run

```powershell
npm install
npm run db:seed
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`. The API listens on `http://localhost:4000`. At startup, the API creates and seeds the default local SQLite database at `server/data/opsmind.sqlite` if it is empty.

The root development script starts the API and Vite together. Vite proxies `/api` requests to the Express server.

## Environment

Copy `.env.example` to `.env` to configure the server. All example settings have usable defaults.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | Express API port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origin |
| `OPSMIND_DB_PATH` | `./server/data/opsmind.sqlite` | SQLite file location; use `:memory:` for ephemeral tests |
| `MEMORY_PROVIDER` | `local` | Local persistent memory provider |
| `HINDSIGHT_API_URL` | unset | Reserved for an explicitly implemented server-side provider |
| `HINDSIGHT_API_KEY` | unset | Reserved credential; never sent to the browser |

Only the local SQLite provider is currently implemented. Setting `MEMORY_PROVIDER=hindsight` does **not** create a remote connection; the health endpoint and console continue to report `Local Memory Fallback`.

## Commands

```powershell
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
npm run db:seed
npm start
```

`npm start` starts the compiled API. Build first with `npm run build`.

## Demo flow

1. Open the dashboard; review seeded operational history and local memory.
2. Launch a `Payment API outage`, or choose one of the six scenarios from an incident.
3. Open the incident and start the investigation. The agent retrieves actual matching historical experiences and displays the current evidence, root cause, recommended action, and relevant runbook.
4. Request remediation, then reject or approve it. The backend rejects execution unless approval is recorded.
5. Approve and execute; verify the service recovers and the incident resolves.
6. Store the incident experience. The database-backed memory count increases from 50 to 51.
7. Launch another payment incident and run the investigation. Its retrieved matches include the just-saved `INC-0247` experience.
8. Restore the demo data from Settings or `POST /api/demo/reset`.

All infrastructure changes in the hackathon demo are explicitly simulated; the service inventory and analytics identify their data as local or simulated.

## API

Successful responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "code": ..., "message": ... } }`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | API, database and memory provider status |
| `GET` | `/api/dashboard` | Dashboard metrics and recent services, incidents and memories |
| `GET` | `/api/incidents?q=` | Search incidents |
| `POST` | `/api/incidents` | Create a validated demo scenario |
| `GET` | `/api/incidents/:id` | Incident, available events, investigation and actions |
| `POST` | `/api/incidents/:id/investigate` | Retrieve memory and compute deterministic reasoning |
| `POST` | `/api/incidents/:id/actions` | Create an approval-required action |
| `POST` | `/api/actions/:id/decision` | Record an operator approval or rejection |
| `POST` | `/api/actions/:id/execute` | Execute an approved simulated remediation and verify recovery |
| `POST` | `/api/incidents/:id/learn` | Persist the resolved incident as a memory |
| `GET` | `/api/memories?q=&service=` | Search persistent memory records |
| `GET` | `/api/services` | Current simulated service health |
| `GET` | `/api/runbooks` | Structured service recovery procedures |
| `GET` | `/api/analytics` | Aggregations of stored incidents and resolution history |
| `POST` | `/api/demo/reset` | Restore all demo tables to their initial seed state |

## Seed data and database

Seeding is idempotent and only inserts the initial dataset when the service table is empty. A fresh demo contains 10 services, 30 resolved incidents, 50 memories (at least 30 incident experiences and 20 lessons), 10 runbooks, and historical root-cause patterns. `POST /api/demo/reset` deletes demo changes transactionally and restores these records.

## Testing and quality checks

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

Tests cover evidence-ranked similarity, stored-memory retrieval, incident creation, backend approval enforcement, action execution, recovery, learning, and retrieval in the next incident.

## Troubleshooting

- If port `4000` is occupied, set `PORT` in `.env` and point the Vite proxy in `client/vite.config.ts` to that API port.
- If the database file is not writable, set `OPSMIND_DB_PATH` to a writable absolute path.
- If npm reports blocked dependency install scripts, approve `better-sqlite3` and `esbuild` with the package-manager facility available on the machine, then rerun `npm install`.
- If browser API requests fail, confirm that both the server and the Vite proxy target are running.

## Project structure

```text
client/src/components/  Navigation, incident workflow controls and shared console elements
client/src/pages/       Dashboard, incident, memory, service, runbook and analytics views
client/src/hooks/       API-backed loading and retry state
client/src/services/    Typed API client
client/src/types/       Shared client-facing domain models
server/src/routes/      Validated HTTP API and workflow integration tests
server/src/database/    SQLite schema, connection and idempotent seed data
server/src/services/    Deterministic incident agent and local memory search
server/src/types/       Strict domain and response models
```