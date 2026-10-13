Escrow is a legal and financial arrangement where a neutral third party temporarily holds money, assets, 
or documents on behalf of a buyer and a seller. The third party releases these items only when all specific conditions a seller. 
The third party releases these items only when all specific conditions of the contract are met



payment webhook

The Connects checkout webhook is served at `/api/v1/connects/webhook` (the
`/api/v1/connects/webhooks` spelling used below is accepted too). Calls that do
not match one of those two paths fall through to the router's auth middleware
and are rejected with a 401, so every delivery is silently dropped.

1. `stripe login`
2. `stripe listen --forward-connect-to localhost:8080/api/v1/connects/webhooks --all-snapshot`
3. Copy the `whsec_...` printed by `stripe listen` into `STRIPE_WEBHOOK_SECRET`
   in `server/.env`, then restart the server. `stripe listen` prints a new secret
   every time it starts, and a stale value makes signature verification fail
   with a 400, so this step has to be repeated after each restart.

A paid Checkout Session is also credited through `POST /api/v1/connects/confirm`
when the buyer returns to the dashboard, which covers deliveries the webhook
missed.

### Purchase safety net

Three layers now make sure a paid purchase is never lost, and all three are
idempotent because the Stripe Checkout Session id is the payment id:

1. the Stripe webhook (`/connects/webhook` or `/connects/webhooks`),
2. `POST /connects/confirm` when the buyer is redirected back to the dashboard,
3. a reconciliation job that re-checks paid Checkout Sessions from the last 48
   hours and credits any without a purchase record.

The reconciliation runs every 5 minutes inside the API process. Serverless hosts
have no long-lived process, so `vercel.json` schedules the same job through a
cron instead:

```json
{ "crons": [{ "path": "/api/v1/connects/reconcile", "schedule": "*/5 * * * *" }] }
```

Set **one** of these in the deployment environment, and the endpoint turns on
(with neither set it stays hidden behind a 404):

- `CRON_SECRET` — Vercel injects it as `Authorization: Bearer <CRON_SECRET>` on
every cron invocation, so Vercel Cron needs no extra configuration.
- `CONNECTS_RECONCILE_SECRET` — for manual runs and external schedulers, sent as
  the `x-reconcile-secret` header.

```bash
# either header is accepted, on GET or POST
curl -X POST https://<api-host>/api/v1/connects/reconcile \
  -H "x-reconcile-secret: $CONNECTS_RECONCILE_SECRET"

curl https://<api-host>/api/v1/connects/reconcile \
  -H "Authorization: Bearer $CRON_SECRET"
```

Vercel validates the schedule against the plan, and the **Hobby plan only allows
one run per day**; use `"0 3 * * *"` there. The 48 hour lookback makes any
frequency at least daily safe.

Add a retry/replay safety net that reconciles uncredited Stripe checkout sessions on a schedule




diff between SSE and WebSocket

websocket can do tow way conminication why which mean i can send a message and i am also sending message to you white sse is i can send you a message but you can not send me a message.
sse only send event from server to frontend and frontend can not send any data to sse
websocket can send data i the frontend while sse can not






