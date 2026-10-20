# CLAUDE.md — Gadgets Garden

E-commerce platform for a Lagos gadget retailer (Computer Village, Ikeja) selling premium
new and foreign-used laptops. Sales run through Instagram and WhatsApp today; this moves
them onto a storefront with real checkout.

- `DESIGN.md` — the visual brief, and where every token came from.
- `~/.claude/plans/valiant-squishing-dream.md` — the build plan and phase order.

## Workspace

| App | Stack | Port |
|---|---|---|
| `backend/` | Laravel 13, PHP 8.3, PostgreSQL | 8000 |
| `storefront/` | Next.js 16, React 19, Tailwind v4, shadcn, framer-motion | 3000 |
| `backoffice/` | Next.js 16, React 19, Tailwind v4 | 3001 |

`./dev.sh` runs everything; `./dev.sh --list` shows services and groups
(`all`, `api`, `front`). Postgres must already be running.

Databases: `gadgetsgarden` (dev) and `gadgetsgarden_test` (the suite —
`createdb gadgetsgarden_test` if it is missing).

## Rules that are not negotiable

**Money is integer whole naira.** `620000` means ₦620,000, never kobo. No price in this
business has a kobo component. If a payment provider ever speaks minor units, convert
inside that gateway class — never in the schema, the API, or a frontend.

**Stock is a ledger, never an assignment.** Quantity-tracked products change only through
a `stock_movements` row written in the same transaction as the new total. `PATCH` on a
product rejects a `stock` field with 422. Serialized units get the same treatment through
`unit_events`. Three CHECK constraints hold the invariants in the database, not just in
application code.

**Payment state is only ever set server-side**, from `verify()` or an authenticated
webhook. The browser is never believed about its own payment. Transitions are idempotent —
a webhook and a customer poll can both land for the same payment and the second is a no-op.

**Stock decrements on payment success**, inside the same transaction as the `paid`
transition. Never at cart time, never at order creation — holding stock for unpaid orders
lets anyone empty the shop by filling carts they never pay for. Serialized units are the
exception and are *reserved* at order creation, because two customers must not both reach
the pay screen for the same physical laptop; `orders:expire-unpaid` releases them.

**The Xendify webhook key is the only lock on settlement.** It is a static bearer token,
not a per-request signature, and a body that clears it is believed without an outbound
confirmation call. Never log it. Rotate it if it is ever exposed. It fails closed when
unset — every webhook 401s rather than settling anonymously.

**A failed payment keeps its reservation.** A failed transfer is usually retried within
minutes, so releasing the machine immediately would hand it to someone else. That means
a `failed` order is still holding stock, which is why `Order::HOLDING_STATUSES` includes
it and the expiry sweeper collects both. Change one without the other and a single failed
payment removes a one-of-a-kind laptop from the catalogue permanently.

**Mirror database column defaults in `$attributes` on the model.** Eloquent does not read
a column default back after an insert, so a freshly created row has `null` in memory where
the database has a value. This is not theoretical: `$order->currency` reached the payment
gateway as null before `Order::$attributes` was added.

## API shape

`{ data }`, or `{ data, meta }` for lists. Errors: `422 { message, errors: {field: [msg]} }`,
`401 { message: "Unauthenticated." }`, `403 { message: "This action is unauthorized." }`,
`404 { message: "<Resource> not found." }`.

Auth is Sanctum **tokens**, not cookie/SPA mode — the frontends are on different origins.
The backoffice's Next route handlers hold the token in an httpOnly cookie and attach it as
a bearer header; **the token must never reach client JavaScript**. That is the entire
reason the backoffice is Next rather than a Vite SPA.

**The dashboard auth guard calls `/api/me`; it does not just check for a cookie.** A
cookie-presence check (in `proxy.ts`, say) cannot tell whether the token inside is still
valid, so it would happily admit someone whose account was deactivated mid-shift — exactly
the case `EnsureUserIsActive` exists to catch.

**A status transition is never a form field.** Order status moves only through
`OrderTransitions`, which validates against a graph and is the reason `next_statuses` is
computed server-side and sent to the UI. Deriving the buttons client-side would put the
graph in two places, and the drift shows up as a button that always errors. Unit status is
the same: it is a consequence of orders, so the unit edit endpoint refuses it.

## Next.js 16 — differs from most training data

Read `storefront/node_modules/next/dist/docs/` before reaching for a pattern from memory.
The ones that bite:

- **`params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are async only.**
  Synchronous access was removed, not deprecated. Always `await`.
- Use the generated helpers — `PageProps<'/product/[slug]'>`, `LayoutProps`,
  `RouteContext` — via `npx next typegen`.
- **`middleware.ts` is now `proxy.ts`**, exporting `proxy`. Node runtime only; the edge
  runtime is not supported there. Config flags renamed too (`skipMiddlewareUrlNormalize` →
  `skipProxyUrlNormalize`). This matters for the backoffice auth proxy.
- Parallel route slots require an explicit `default.tsx` or the build fails.
- `next lint` is gone; ESLint uses flat config.
- Turbopack is the default for both dev and build.
- `scroll-behavior: smooth` is no longer overridden during navigation unless
  `data-scroll-behavior="smooth"` is set on `<html>` — it already is, in
  `storefront/app/layout.tsx`.
- **`fetch` is not cached by default**, and uncached data read outside a
  `<Suspense>` boundary (or `use cache`) is a BUILD error, not a warning. The
  storefront wraps every data read in Suspense with a skeleton, deliberately:
  stock changes when someone buys, so cached `available_count` would advertise a
  laptop that is already sold.
- **Never wrap `fetch` in a blanket `try/catch`.** Next throws through `fetch` as
  control flow — a prerender touching uncached data aborts by throwing, which is
  how the framework decides a route is dynamic. Catching that and rethrowing your
  own error breaks the build with a fabricated "API unreachable" against a
  backend that is perfectly healthy. `lib/api.ts` converts only `TypeError` and
  rethrows everything else; the comment there explains why.
- **`useSearchParams()` needs its own Suspense boundary.** It opts the subtree
  out of static prerendering, so a component using it inside the root layout
  fails the production build on statically generated routes (`/_not-found`).
  Both header components that use it are wrapped.

These last three only surface in `npm run build`, never in `next dev`. Run the
production build before calling frontend work done.

## Storefront conventions

**`.dark` is a section wrapper, not a theme toggle.** The system is light-led with dark
bookends (`DESIGN.md` §4): white catalogue, black hero/footer. Put `class="dark"` on a
section and every shadcn component inside re-themes, because the variant matches any
descendant. The `.dark` rule re-declares `color` for a reason documented in `globals.css`
— removing it makes text inside dark sections render near-black on black.

**All scroll animation goes through `<Reveal>` / `<Stagger>`**
(`components/motion/reveal.tsx`). Do not hand-roll `whileInView` per section — a dozen
sections each picking their own timing reads as jitter. Timing lives in `TRANSITION`
(`components/motion/motion-provider.tsx`) and nowhere else.

**Reduced motion is handled twice, deliberately.** The CSS guard in `globals.css` kills
transitions and keyframes; `MotionConfig reducedMotion="user"` kills Framer's
JS-driven animations, which no stylesheet can touch. Both are required.

**Prices always use `PriceTag`/`PriceFrom` and the `gg-numeric` class** so digits are
tabular and align down a grid column. Never format naira inline — use `lib/format.ts`.

**Condition is a first-class component** (`ConditionBadge`), not an ad-hoc badge colour.
Colour never carries the meaning alone; the label always renders.

`/styleguide` renders every token and primitive on **both** surfaces. It is where a
contrast regression gets caught — it has already caught two. Check changes there.

## Production

`deploy/README.md` is the runbook. Three processes behind Caddy: two Next apps on
3000/3001, Laravel via php-fpm, plus a queue worker and a per-minute scheduler.

**Going live with payments is four steps in order** — credentials, register the
webhook at `/api/shop/payments/webhook/xendify` (the gateway's `name()`, not the
bank partner), `config:cache` + restart the worker, then a real ₦100 test order.
The mock provider settles on request and authenticates nothing; it must never be
bound anywhere real. Once a real provider is bound, `mock-settle` 404s and the
storefront's simulate controls hide themselves off that 404 — no env flag to
remember.

**Two failure modes worth recognising by their symptom:**

- *"Payments aren't working"* but orders are marked paid → the queue worker is
  dead. Receipts are queued, so a dead worker looks like a payment failure to
  staff even though the money arrived.
- *Stock quietly disappearing* → the scheduler is not running.
  `orders:expire-unpaid` is what returns abandoned reservations to the shelf, and
  without it every unfinished checkout permanently removes a one-of-a-kind
  machine from the catalogue.

**Transactional email is deliberately sparse.** `OrderConfirmed` on payment,
`OrderStatusChanged` on a real transition — and nothing else. A no-op transition,
a staff note, or a refused transition sends nothing. An inbox that pings whenever
someone opens an order page teaches customers to ignore the mail that matters.

## Testing

PHPUnit against Postgres (`php artisan test`). The suite must cover, at minimum:
settlement is idempotent under repeated webhooks; underpayment leaves the order pending;
an unauthenticated webhook 401s and settles nothing; a unit cannot be sold twice; stock
never goes negative; `stock_after = stock_before + delta` holds; catalogue `PATCH` rejects
`stock`.

Payments are developed against `MockGateway` and `POST /api/shop/payments/mock-settle`,
which drives a full order → pay → paid → stock-moved cycle with no live keys.

## Copy that must survive onto the site

The brand's differentiation, stated on nearly every Instagram post — state it plainly
rather than burying it:

- **We don't do:** swap · trade-ins · easy buys · **pay on delivery**
- Warranty available on all items · nationwide delivery · 24/7 support
- Tagline: QUALITY. TRUST. PERFORMANCE.
