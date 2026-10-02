## Docker Compose

Run the commands from the `server` directory:

```bash
cd /home/daniel/Desktop/onemarketplace-starter/server
docker compose config
docker compose up -d
docker compose ps
```

`docker compose config` validates and renders the Compose configuration.
`docker compose up -d` pulls the required images and starts the services in the background.
`docker compose ps` shows the running containers, ports, and health status.

## Vercel Deployment

Set the Vercel project's **Root Directory** to `server`. The `vercel.json` in
this directory runs `npm run build` to compile TypeScript into `dist/`, then
builds `dist/vercel-handler.js` as a Node.js function and routes requests to the
existing Express app. Do not set a static output directory.

The function initializes the existing database client from
`src/database/clients.ts` on its first invocation in each warm instance. Local
development continues to use `npm run dev` and `src/server.ts`.

Configure `DATABASE_URL` in Vercel for every deployment environment. It must be
the connection string for the existing Neon database. The freelancer profile
limits have validated defaults matching the local project configuration; set
`FREELANCER_MAX_PORTFOLIO_PROJECTS`, `FREELANCER_MAX_SKILLS`,
`FREELANCER_MIN_SKILLS`, `FREELANCER_MAX_LANGUAGES`,
`FREELANCER_MAX_SKILL_LENGTH`, `FREELANCER_MAX_TEXT_LENGTH`,
`FREELANCER_MAX_DESCRIPTION_LENGTH`,
`FREELANCER_MAX_PORTFOLIO_DESCRIPTION_LENGTH`, or
`FREELANCER_MAX_BASE64_IMAGE_BYTES` only when overriding those defaults. Any
configured limits must be positive integers. Configure `CLERK_SECRET_KEY`,
`CLERK_WEBHOOK_SIGNING_SECRET`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`,
and `IMAGEKIT_END_POINT` if the corresponding integrations are enabled. Redis is
optional; set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, and `REDIS_DB` when
using a hosted Redis service. Without Redis, the API logs the connection failure
and continues without the auth cache.

After deployment, verify `GET /health` for function availability and
`GET /api/v1/health` for database connectivity. API routes remain under
`/api/v1`.

To stop the services:

```bash
docker compose down
```

## Activities Performed

- Fixed the top-level Compose key from `server` to `services`.
- Corrected the NATS volume mapping to `nats_data:/data`.
- Fixed the indentation of the top-level named volumes.
- Aligned the Redis mount with the declared `redis_data` volume.
- Validated the configuration successfully with `docker compose config`.
- Started Redis and NATS with `docker compose up -d`.
- Confirmed both containers are running; Redis reports a healthy status.
- Fixed a Redis `WRONGPASS` error caused by an extra space in `REDIS_PASSWORD= ${...}`.
- Recreated Redis with `docker compose up -d --force-recreate redis` and verified authentication with `PONG`.

## Running Services

- Redis: `127.0.0.1:6379`
- NATS client: `127.0.0.1:4222`
- NATS monitoring: `127.0.0.1:8222`

## Redis Authentication Troubleshooting

The Redis password must not contain a space after the equals sign in
`docker-compose.yml`:

```yaml
REDIS_PASSWORD=${REDIS_PASSWORD:-onemarketplace}
```

Keep the same value in the server `.env` file:

```env
REDIS_PASSWORD=onemarketplace
```

After changing the password configuration, recreate Redis:

```bash
docker compose up -d --force-recreate redis
docker compose exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" ping'
```

The expected response is `PONG`.
