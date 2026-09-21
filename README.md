# Doraha Eats

**Doraha da apna food delivery.**

A local food delivery platform for Doraha, Ludhiana district, Punjab — connecting
Doraha residents with local food stalls, delivered by local delivery partners.

This is a **running, tested MVP**, not a prototype. All core data lives in
PostgreSQL; nothing is faked in frontend state. Only external services
(SMS/OTP delivery, UPI settlement, maps tiles, push notifications) are mocked
with local-first adapters that require no paid API keys to run.

```
Customer (Expo app) ─┐
Vendor   (Expo app) ─┼──► API (Node/Express/TypeScript) ──► PostgreSQL
Rider    (Expo app) ─┘         ▲
Admin (Next.js, web) ──────────┘
```

---

## What's here

| Path | What it is | Status |
|---|---|---|
| `server/` | REST API — auth, catalog, cart, orders, delivery, admin | **Built, running, tested** |
| `apps/admin/` | Next.js admin dashboard | **Built, running, tested** |
| `apps/mobile/` | Expo app — customer, vendor, and rider, one binary | **Built, typechecked, bundled** |
| `docs/reference-schema.prisma` | The originally-requested Prisma schema, for reference | Not used at runtime — see note below |

### A decision made for you: Drizzle instead of Prisma

Prisma's query/schema engine binaries download from `binaries.prisma.sh`,
which was blocked in the sandbox this was built in (network egress
allowlist). Since a **running** MVP mattered more than matching a named
tool, the data layer was built on **Drizzle ORM** instead — pure
TypeScript, no downloaded binaries, same PostgreSQL underneath. The
originally-modelled Prisma schema is kept at `docs/reference-schema.prisma`
so the intent is traceable; `server/src/db/schema.ts` is the live one, and
`server/drizzle/0000_init.sql` is the migration that actually created every
table in the running database.

On a normal machine (unrestricted network) Prisma installs fine, and the
service/repository split in `server/src/services/` means switching back is
mechanical — swap `src/db/index.ts` and the query calls inside
`src/services/*.ts`, nothing else in the app knows which ORM is underneath.

---

## Run it

### 1. Database

```bash
# Any local PostgreSQL 14+ works. Example with the system package:
sudo apt-get install postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'devpass';"
sudo -u postgres psql -c "CREATE DATABASE doraha_eats;"
```

### 2. API server

```bash
cd server
cp .env.example .env          # defaults already point at the DB above
npm install
npm run db:migrate            # applies server/drizzle/0000_init.sql
npm run seed                  # 3 zones, 10 categories, 10 vendors, 61 dishes,
                               # 5 customers, 5 riders, 5 demo orders
npm run dev                   # http://localhost:4000/api/v1
```

Demo credentials (local development only, password `Doraha@123` unless you
change `DEMO_PASSWORD` in `.env`):

| Role | Email | Password |
|---|---|---|
| Customer | `customer@dorahaeats.local` | `Doraha@123` |
| Vendor | `vendor@dorahaeats.local` | `Doraha@123` |
| Delivery | `delivery@dorahaeats.local` | `Doraha@123` |
| Admin | `admin@dorahaeats.local` | `Doraha@123` |

Customers can also sign in with phone + OTP — in development the OTP is
printed to the server console (`SMS_PROVIDER=console`), no SMS account
needed.

### 3. Admin dashboard

```bash
cd apps/admin
cp .env.example .env.local    # points at the API above
npm install
npm run dev                   # http://localhost:3000
```

### 4. Mobile app

```bash
cd apps/mobile
cp .env.example .env          # EXPO_PUBLIC_API_URL — point this at your machine's
                               # LAN IP (not localhost) to test on a real phone
npm install
npx expo start                # scan the QR code with Expo Go, or press `w` for web
```

### 5. Run the tests

```bash
cd server
npm test                      # 28 unit tests — pricing, status machine, zones, hours
node tests/acceptance.mjs     # 47 checks — the full 27-step flow against a live server
```

---

## What's verified, and how

**Unit tests (28/28 passing, `server/tests/business-logic.test.ts`)** — pure
business logic with no I/O: order-total arithmetic (subtotal, delivery fee,
platform fee, tax-on-food-not-fees, discount capping, vendor-specific
commission), the order status state machine (every legal and illegal
transition, who may set what), haversine zone-distance math, and vendor
opening-hours logic including the midnight-crossing case.

**Acceptance test (47/47 passing, `server/tests/acceptance.mjs`)** — runs
the exact 27-step flow over live HTTP against a seeded database: customer
login → zone resolution → browse → search → cart with customizations →
quote → place COD order → vendor accepts → PREPARING → READY → rider
claims → PICKED_UP → ON_THE_WAY → DELIVERED → customer sees DELIVERED →
review → admin sees everything. Also proves the guard rails actually
fire: a New Delhi coordinate is refused with *"Delivery is currently
unavailable at this location,"* a cart under the zone minimum is blocked,
adding a second stall's item to the cart is rejected, a second rider can't
steal an accepted delivery, cross-customer order access returns 403, and
an admin fee change flows straight into checkout pricing.

**Admin dashboard** — `npm run build` succeeds (12 routes, clean
TypeScript), and with the API running, all pages return 200 and render
real data (zones, vendors, orders, analytics) fetched live.

**Mobile app** — `npx tsc --noEmit` is clean across all 23 screens, and
`npx expo export --platform web` successfully bundles the entire app (741
modules) with no errors. The web export was served locally and its bundle
loaded correctly with the API running alongside it. Native Android/iOS
device testing was not possible in this environment — do that with
`npx expo start` and Expo Go before shipping.

---

## Demo data

Seeded by `server/src/db/seed.ts`. Every vendor name is prefixed `[DEMO]`
and flagged `isDemo: true` — **none of these are real Doraha businesses**:

- 3 delivery zones: Doraha Main Bazaar and GT Road side (**active**), plus
  Payal (**inactive** — proves expansion requires explicit admin
  activation; an address there is correctly refused)
- 10 categories, 10 vendors, 61 food items (many with size/spice/add-on
  customizations)
- 5 demo customers, 5 demo delivery partners (pre-approved so the flow
  runs immediately), 5 historical demo orders

---

## Architecture notes

- **Money** is an integer count of paise everywhere — database, API,
  mobile app. No floats. `server/src/services/pricing.service.ts` is the
  single place totals are computed; the mobile app only ever displays
  what that returns.
- **Delivery zones** are admin-configured rows (`server/src/services/zone.service.ts`),
  never a hard-coded radius. A location outside every active zone gets
  the required message: *"Delivery is currently unavailable at this
  location."* A new zone defaults to `isActive: false` — expansion is
  always opt-in.
- **Order status** is a strict state machine
  (`server/src/services/orderStatus.ts`): every transition and who may
  make it is whitelisted; anything else is rejected with
  `INVALID_TRANSITION`.
- **External services are behind adapters**
  (`server/src/adapters/{payments,sms,push,storage,maps}`), each with a
  working local-first default and zero required paid API keys: COD works
  fully, UPI uses a real `upi://pay` deep link with UTR entry + admin
  verification (swap in Razorpay later behind the same interface), OTPs
  print to the console, notifications live in Postgres and are polled,
  file uploads serve from local disk, and maps use `geo:` URIs for
  navigation rather than a paid tiles API.
- **One Expo binary, three role-scoped route groups**
  (`apps/mobile/app/(customer)`, `(vendor)`, `(rider)`) — the root layout
  branches on the logged-in user's role. Real-time-ish updates use
  polling (5–6s) rather than WebSockets, matching the "no expensive
  infrastructure for MVP" instruction; the code is structured so
  WebSockets/SSE can replace polling later without touching business
  logic.

---

## Honest limitations

- Native mobile builds (APK/IPA) were not produced or tested on a device —
  only typechecked and bundled for web. Run `npx expo start` and test in
  Expo Go, then `eas build` when ready for Play Store internal testing.
- Vendor menu creation from the app is partial (availability toggle
  works; adding new items/photos from the vendor app itself isn't wired
  up yet — it works from the API and could be added to `apps/mobile/app/(vendor)/menu.tsx`).
  Vendors can be onboarded via direct API calls or a future admin
  seed/import.
  Favorites, notifications list, and Help & Support screens in the
  customer app are stubbed placeholders — the backend endpoints exist
  and are tested; the screens just need to be built out.
- Push notifications are in-app/polled only (Expo Push/FCM adapter is
  stubbed but not wired to a real push send).
