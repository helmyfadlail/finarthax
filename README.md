# Finarthax

A personal finance manager for people who want to know exactly where their money goes — accounts, transactions, recurring-transaction suggestions, budgets, goals and reports, in three languages and any currency.

Built with Next.js 16 (App Router), React 19, Prisma 7 and PostgreSQL.

---

## Table of contents

- [Getting started](#getting-started)
- [How the app is organised](#how-the-app-is-organised)
- [Authentication & accounts](#authentication--accounts)
- [Money accounts](#money-accounts)
- [Transactions](#transactions)
- [Quick entry without signing in](#quick-entry-without-signing-in)
- [Recurring transactions](#recurring-transactions)
- [Categories](#categories)
- [Budgets](#budgets)
- [Goals](#goals)
- [Dashboard](#dashboard)
- [Reports & export](#reports--export)
- [Settings](#settings)
- [Notifications & email](#notifications--email)
- [Currency](#currency)
- [Internationalisation & routing](#internationalisation--routing)
- [Health & maintenance](#health--maintenance)
- [Logging & tracing](#logging--tracing)
- [API documentation](#api-documentation)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Deployment](#deployment) · [full Ubuntu guide →](DEPLOYMENT.md)
- [Conventions](#conventions)

---

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)

### Install and run

```bash
git clone <your-repo-url>
cd financial_management_app
npm install
```

Copy the template and fill it in:

```bash
cp .env.example .env
```

[`.env.example`](.env.example) lists every variable the app reads, grouped and commented. Only three are needed to boot — the rest switch on optional features, and the app degrades cleanly without them:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finarthax"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""   # openssl rand -base64 32
```

**Now seal it — the app will not start otherwise:**

```bash
npm run env:key      # writes .env.key (once per machine)
npm run encrypt      # seals every value in .env
```

Finarthax refuses to boot while `.env` holds plain text. See [Encrypting .env](#encrypting-env) for how the check works and what it does and does not protect.

Then prepare the database and start the app:

```bash
npm run db:migrate     # create and apply migrations
npm run db:generate    # regenerate the Prisma client
npm run db:seed        # seed data
npm run dev
```

To change a setting later, open the file, edit it, and seal it again:

```bash
npm run decrypt      # back to plain text
# ...edit .env...
npm run encrypt      # seal again — required before the app will run
```

`db:seed` runs `prisma/seed-dev.ts` outside production and `prisma/seed.ts` in production. The dev seed creates a demo user (`demo@finance.com`) with six months of realistic history across five accounts, three already-tracked recurring series, budgets sized against real spend, and goals — plus plenty of untracked repeats for the recurring detector to find.

Open [http://localhost:3000](http://localhost:3000). You will be redirected to a locale-prefixed route (`/en`, `/id` or `/zh`); the dashboard lives at `/en/admin/dashboard`.

> **Upgrading an existing install?** Run `npm run db:migrate` then `npm run db:generate` — the recurring feature adds six columns and one enum to `transactions`.

### Tech stack

| Area         | Choice                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| Framework    | Next.js 16 — App Router for pages, route handlers for the API             |
| UI           | React 19, Tailwind CSS v4, Recharts                                       |
| Data         | PostgreSQL 15, Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`) |
| Server state | TanStack Query v5                                                         |
| Auth         | NextAuth v4 (Credentials + Google), JWT sessions, bcrypt                  |
| Validation   | Zod v4, shared between route handlers and forms                           |
| i18n         | next-intl (`en`, `id`, `zh`)                                              |
| Email        | Resend                                                                    |
| Uploads      | ImageKit                                                                  |
| PDF          | PDFKit                                                                    |

---

## How the app is organised

```
.env.example               Every variable the app reads, with placeholders
Dockerfile                 Multi-stage image; the runner needs scripts/ to boot
docker-compose.yml         Postgres + app, plus an opt-in digest scheduler
scripts/
  env-crypto.ts            AES-256-GCM helpers for .env values
  env-cli.ts               npm run encrypt / decrypt / env:status / env:key
  load-encrypted-env.ts    Opens sealed values before app code runs
prisma/
  schema.prisma            Data model
  migrations/              Applied by entrypoint.sh on container start
  seed.ts / seed-dev.ts    Production and demo seeds
public/
  openapi.json             API specification (served at /openapi.json)
  fonts/                   Font used by the PDF export — required at runtime
src/
  app/
    [locale]/              Locale-prefixed pages (auth screens + /admin/dashboard/*)
    api/
      (public)/            No session required: auth, public settings, quick transactions
      (protected)/         Everything behind a session
      health/              Container probe
    api-docs/              Swagger UI
  components/              Presentational primitives (button, input, modal, toast, …)
  layouts/
    ui/                    One file per dashboard screen
  hooks/api/               One TanStack Query hook per resource
  lib/                     Server-side logic: prisma, auth, logging, transaction maths, recurrence engine
  types/
    api.ts                 Shared response and domain types
    validations/           Zod schemas shared by routes and forms
  utils/                   API client, response helpers, formatters
  static/                  Client-safe constants, one file per purpose:
    env.ts                   values read from the environment
    locales.ts               the languages the app ships
    currencies.ts            currency options, locale map, zero-decimal list
    preferences.ts           the choices behind each preference select
    recurring.ts             recurrence intervals and icons
    user-settings.ts         the per-account preference catalogue
    content.ts               public-page copy stored as app settings
    app-settings.ts          options, flags, limits, app info + the assembled APP_SETTINGS
  i18n/                    next-intl routing and request config
  proxy.ts                 Middleware (locale handling)
messages/                  en.json, id.json, zh.json
k8s/                       Namespace, config map, secret, Postgres, app, ingress,
                           and the digest CronJobs
```

Every folder exposes a barrel `index.ts`, so imports stay short: `import { prisma, requireAuth } from "@/lib"`.

### Providers and the session boundary

Every provider is mounted in a **layout**, never inside a screen component, so no page can render without them.

| Provider | Mounted in | Needs a session? |
| --- | --- | --- |
| `QueryProvider` | `app/layout.tsx` | No — a client-side cache, used by public pages too |
| `AuthProvider` | `app/layout.tsx` | It *supplies* the session for everything below |
| `ThemeProvider` | `app/layout.tsx` | Yes to take effect — dark is only ever applied while signed in |
| `ToastProvider` | `app/layout.tsx` | No |
| `CurrencyProvider` | `app/layout.tsx` | Optional — base currency when signed out, the account's currency when signed in |
| `LocaleSync` | `app/[locale]/layout.tsx` | Yes — no-ops without an account |

Two rules decide where something goes:

- **Anything that reads the locale goes in the `[locale]` layout**, because that is where next-intl's provider lives. `LocaleSync` navigates between locales, so it cannot sit any higher.
- **Everything else goes in the root layout**, and degrades on its own rather than being gated. A provider that reads an account preference falls back to a sensible default when there is no account, so the landing page, the auth screens and the dashboard all share the same formatting and theming code.

Two account features are deliberately **not** extended to visitors:

- **Theme.** Dark mode is an account setting, so the `dark` class only goes on the document while there is a session — `"system"` included. The landing page and the auth screens always render in the light palette, and signing out removes the class rather than carrying dark styling into the public pages.
- **Currency.** Amounts stay in the base currency until an account says otherwise.

That is what makes the currency behave correctly on public pages:

| | Signed out | Signed in |
| --- | --- | --- |
| Display currency | `BASE_CURRENCY` (`Rp`) | The `currency` preference |
| Exchange rates | **Never fetched** — nothing to convert | Fetched only when the preference differs from the base |
| `hideAmounts` | Not applied — it is an account preference | Applied |
| Theme | Light, always | The `theme` preference |
| `canChangeCurrency` | `false` — no picker is offered | `true` |

The provider exposes `canChangeCurrency` so a component can ask whether switching is available instead of re-deriving it from the session. Changing currency stays where it belongs: the settings screen, behind auth.

Three rules hold everywhere:

1. **One response envelope.** `successResponse`, `errorResponse` and `validationErrorResponse` in [`src/utils/api-response.ts`](src/utils/api-response.ts) are the only ways a route replies.
2. **One validation source.** A Zod schema in `src/types/validations` defines a payload once; the route parses with it, the form reuses the same types.
3. **One place money moves.** `applyBalanceChange` and `applyBudgetChange` in [`src/lib/transaction.ts`](src/lib/transaction.ts), always inside `prisma.$transaction`.
4. **One request wrapper.** `withApi` in [`src/lib/api-handler.ts`](src/lib/api-handler.ts) owns the request id, logging, maintenance gate and error mapping for every route — see [Logging & tracing](#logging--tracing).

---

## Authentication & accounts

Sessions are **JWT**, not database-backed, with a lifetime of `SESSION_EXPIRATION` seconds (default 15 minutes).

### Sign-in methods

**Email + password.** The credentials provider raises a distinct error for each failure so the login screen can say something useful: the email isn't registered, the account uses Google, the password is wrong, or the password has expired.

**Google.** On a first Google sign-in the `signIn` callback creates the user and bootstraps their workspace. `allowDangerousEmailAccountLinking` is on, so signing in with Google using an email that already has a password account links to it rather than failing.

### What a new account gets

Both registration paths create the same starting point: **ten default categories** (Salary, Bonus, Freelance, Others for income; Food & Drinks, Transportation, Shopping, Entertainment, Bills, Healthcare for expenses) and a default **Cash** account. Registration additionally happens inside a single database transaction, so a half-created user is impossible.

Registration is refused with `403` when the `allow_registration` app setting is off.

### Password expiry

Passwords carry `passwordChangedAt` and `passwordExpiresAt`, computed from the `max_password_age_days` app setting (90 days if unset). The `session` callback re-reads the user from the database on every session check, so an expired password invalidates the session immediately — even one already issued. The dashboard layout notices the empty session and redirects to `/login?reason=password_expired`.

### Password reset

`POST /api/auth/forgot-password` generates 32 random bytes, stores only the **SHA-256 hash** in `verification_token` with a one-hour expiry, and emails the plain token as a link through Resend. Accounts registered via Google have no password to reset and are told so explicitly.

---

## Money accounts

Five types: `CASH`, `BANK`, `EWALLET`, `CREDIT_CARD` and `INVESTMENT`. Each has a balance, an optional colour and icon, and an `isDefault` flag — setting it on one account clears it on all the others.

The number of accounts a user may create is capped by the `max_accounts_per_user` app setting. `creditLimit` is only stored for credit cards; it is dropped for every other type.

### Credit cards are modelled as debt

A credit-card balance is stored **negative**, and its magnitude is what you owe:

| Action                         | Effect on the card                                        |
| ------------------------------ | --------------------------------------------------------- |
| Expense charged to the card    | Balance goes further negative — debt grows                |
| Transfer _from_ bank _to_ card | Balance moves toward zero — debt shrinks (a card payment) |
| Transfer _from_ the card       | Debt grows (a cash advance)                               |
| Income on the card             | **Refused** — there is no such thing                      |

The rules live in `validateCreditCardRules`, and the transaction form mirrors them: the `INCOME` option disappears when a credit card is selected, and a contextual hint explains what to do instead. The dashboard shows assets and card debt separately, with a utilisation bar against the credit limit.

---

## Transactions

Three types — `INCOME`, `EXPENSE` and `TRANSFER`. A transfer moves money between two of your own accounts, or **out of the system entirely** when `toAccountId` is left empty, which is how an ATM withdrawal is recorded.

### The bookkeeping

Every write goes through `prisma.$transaction`, so the ledger row and the balances it affects can never diverge:

```
INCOME             account.balance += amount
EXPENSE            account.balance -= amount
TRANSFER           account.balance -= amount
                   toAccount.balance += amount   (only when a destination is set)
```

Budgets are updated in the same step: an `EXPENSE` with a category increments `spent` on the budget for that category and month, if one exists.

**Editing** reverses the old effect before applying the new one; **deleting** reverses it and removes the row. Both use the same two helpers with a `reverse` direction, which is why balances stay exact no matter how much history is rewritten.

### Listing

`GET /api/transactions` filters by type, category, account, date range and a case-insensitive description search, then paginates (20 per page by default, 100 maximum). On the transactions screen every filter is stored in the query string, so a filtered view is a shareable URL and survives a refresh.

---

## Quick entry without signing in

The landing page records a transaction without a session: type your email, the form fills with your accounts and categories, and the entry posts through `/api/quick-transactions`. It is meant for the moment you are standing at a till and do not want to log in.

### Showing balances there

Entering an email can also show that account's balances, including a **live preview of what each balance becomes** once the amount is filled in — the same arithmetic the server applies, so the preview and the saved result agree.

This is **off by default**, and the reason is worth stating plainly: the endpoint takes nothing but an email address. If balances came back unconditionally, anyone who knows — or guesses — your address could read your money. So the account owner decides:

**Settings → Privacy → Public balances**

| | Preference off (default) | Preference on |
| --- | --- | --- |
| Accounts and categories | Returned, so the form works | Returned |
| `balance`, `creditLimit` | **Not in the response at all** | Returned |
| The page shows | A note explaining how to enable it | Balances, totals, and the projected balance |

`showsBalances` in the response says which case applied, so the UI can explain itself instead of rendering zeros.

Two further guards on this endpoint, both because it is unauthenticated:

- **Rate limited** — 20 lookups and 30 writes per minute per client ([`src/lib/rate-limit.ts`](src/lib/rate-limit.ts)). An email-keyed lookup is otherwise a convenient way to discover which addresses are registered. The limiter is per process; put a real one at the edge if you run several replicas.
- **Balances are filtered server-side**, not hidden in the UI. When the preference is off the fields never leave the database, so reading the network response gains nothing.

Credit cards read correctly here too: a negative balance is shown as a positive "owed" figure, and a card in credit is shown as an ordinary balance rather than as debt.

### Repeats from the quick form

The quick form carries the same **Repeat this transaction** control as the dashboard: an interval, and an optional date to repeat until. A subscription paid at a till is the very thing you want tracked, and having to sign in later to say so is how it gets forgotten.

It writes exactly what `POST /api/transactions` writes — `isRecurring`, `recurrenceInterval`, a fresh `recurrenceKey` and the computed `nextOccurrence` — so the series shows up on the recurring screen with a schedule rather than as an unexplained one-off. Nothing is posted on your behalf here either: the repeat is a reminder, and the next occurrence still waits for you to confirm it.

Worth knowing before you enable this on a public instance: the endpoint is unauthenticated and keyed by email, so it now accepts *schedules* and not only single entries. The same rate limits apply (`quick_create_rate_limit`), and every write is logged with the account it landed on.

---

## Recurring transactions

Most finance apps make you _create_ a recurring rule up front, then silently post transactions on your behalf. Finarthax does the opposite: it watches what you actually record, and **suggests**. Nothing is ever written to your ledger without you confirming it.

There is no separate `recurring_transactions` table. A series lives on the transactions themselves, which keeps history, balances and reports in exactly one place.

### The two kinds of suggestion

**1. Scheduled — series you track.**
Tick _"Repeat this transaction"_ when adding a transaction, or press **Track** on a suggestion. Every transaction of the series is stamped with the same `recurrenceKey`, and the most recent one carries `nextOccurrence` — the date the next one is expected. Once that date arrives, the series shows up under **Due now**.

**2. Detected — patterns found in your history.**
Finarthax groups your past transactions and looks for a regular rhythm. If "Netflix 12/2025" and "netflix - 01/2026" land roughly 30 days apart for three months running, that is a pattern worth surfacing — even though you never told the app about it.

### How detection works

Transactions from the history window that are not already part of a series are grouped by **type + source account + destination account + category + normalised description + time of day**. Normalising strips digits, punctuation and casing, so invoice numbers and month suffixes do not split a series in two.

**Time of day is part of the identity**, which is what lets the same habit run more than once a day. A coffee at 08:00 and another at 20:00 share every other attribute; without a time component they would collapse into one pattern with 12-hour gaps and be detected as neither. The day is divided into buckets (`recurring_time_bucket_minutes`, two hours by default) so 08:05 and 08:20 still count as the same slot, while 08:00 and 20:00 become two independent daily series — each with its own schedule, amount and next occurrence.

Within a slot, one occurrence per day is kept: two coffees the same morning are still one habit. Then:

| Step        | Rule                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Volume      | At least `recurring_min_occurrences` occurrences (3 by default)                                                         |
| Cadence     | The median gap must match a known interval: **1** day, **6–8** days, **13–16** days, **27–32** days or **355–375** days |
| Consistency | At least `recurring_min_consistency` of gaps (60%) must sit within 25% of that interval's nominal length                |
| Confidence  | Score ≥ `recurring_min_confidence` (55), from regularity (60%), repeats (25%) and amount stability (15%)                |

Tracking or dismissing a series matches on the slot too, so acting on the morning habit leaves the evening one alone.

Survivors are shown with their confidence score, average amount, predicted next date and an estimated monthly cost — every interval is normalised to a 30.44-day month, so different cadences can be compared and summed.

### What you can do with a suggestion

| Action                | Effect                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Log now**           | Creates a real transaction — balances and budgets move exactly as for a manual entry — and advances the schedule by one period. Amount and date are editable first.                |
| **Skip**              | Moves the schedule to the next _future_ date without creating anything. Use it when an occurrence did not happen, or to catch up a series overdue by months.                       |
| **Track**             | Turns a detected pattern into a scheduled series. Pick the interval and, optionally, an end date.                                                                                  |
| **Stop**              | Removes the schedule from the whole series. Past transactions are untouched.                                                                                                       |
| **Dismiss / Restore** | Hides a detected pattern for good, or brings it back. The flag is stored on the transactions themselves, so a new occurrence does not resurrect a suggestion you already rejected. |

Confirming advances by **exactly one period**, so a series you forgot for three months can be backfilled one occurrence at a time. Skipping jumps straight to the next future date.

### Where it shows up

- **Recurring page** (`/admin/dashboard/transactions/recurring`) — due, upcoming, detected and dismissed, plus how much recurring expense you are committed to each month. It sits under Transactions rather than in the sidebar: it is a view of your transactions, not a separate area. The Transactions header links to it and shows the due count, and the old top-level URL redirects here so older notification emails keep working.
- **Dashboard** — a banner when something is due, or when new patterns are found.
- **Transactions page** — recurring rows are marked 🔁, and the add form can open a series directly.

### Schema

Six nullable columns on `transactions`, plus one enum:

```prisma
enum RecurrenceInterval {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  YEARLY
}

model Transaction {
  // ...
  isRecurring           Boolean             @default(false)  // part of a series (drives the 🔁 badge)
  recurrenceInterval    RecurrenceInterval?                  // how often it repeats
  recurrenceKey         String?                              // groups every occurrence of one series
  nextOccurrence        DateTime?                            // set on the newest occurrence only — the live schedule
  recurrenceEndDate     DateTime?                            // optional stop date
  recurrenceDismissedAt DateTime?                            // "never suggest this pattern again"
}
```

Only one row per series ever holds `nextOccurrence`; that row is the anchor, and confirming an occurrence hands the anchor role to the newly created transaction. Month arithmetic clamps short months, so a series anchored on 31 January lands on 28 (or 29) February rather than rolling into March.

The engine lives in [`src/lib/recurring.ts`](src/lib/recurring.ts) and is pure apart from one query helper, which keeps the date maths and pattern scoring easy to reason about.

---

## Categories

Categories are per user and typed `INCOME` or `EXPENSE`; the transaction form only offers those matching the type being recorded, and transfers take no category at all. Ten are created with every new account, marked `isDefault` so the form can preselect one. The `max_categories_per_user` app setting caps how many a user may add.

---

## Budgets

A budget is a cap for one category in one month, unique on `(user, category, month, year)`. `POST /api/budgets` **upserts**: creating a budget for a category that already has one simply changes the cap.

The clever part is `spent`. When a budget is created, it is backfilled by aggregating the expenses already recorded in that month, so a budget added on the 20th is immediately accurate. From then on it is maintained incrementally by every transaction write, rather than recomputed on read.

The dashboard and the budgets screen show progress bars that change colour as a category approaches and then passes its cap.

---

## Goals

A savings target with an optional deadline and a status of `ACTIVE`, `COMPLETED` or `CANCELLED`. `PATCH /api/goals/{id}/progress` sets the current amount and flips the goal to `COMPLETED` automatically once it reaches its target.

---

## Dashboard

Two endpoints back the home screen.

**`/api/dashboard/summary`** aggregates this month's income, expense and transfer totals with per-type counts, the same figures for last month, and the percentage change between them. It also returns every account with its balance and the five most recent transactions. The UI derives net worth from that: assets are the non-credit-card balances, debt is the absolute value of the credit-card ones.

**`/api/dashboard/charts`** returns six months of income/expense/transfer totals, spending grouped by category, budget progress and a transfer-flow summary (moved, received, and the difference — money that left your accounts).

---

## Reports & export

| Report  | Period                            | Contents                                                                                                                                                                |
| ------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monthly | `?month`&`?year`, defaults to now | Totals, savings rate, average daily expense, largest transaction, top categories, a day-by-day spending trend, and the full transaction list                            |
| Yearly  | `?year`, defaults to now          | A twelve-month breakdown, monthly averages, top categories, and the best and worst month by net balance                                                                 |
| Custom  | `POST` with `startDate`/`endDate` | Everything above plus a per-account breakdown including transfer in/out, and a daily trend. The end date is extended to `23:59:59` so the final day is included in full |

Savings rate is `(income − expense) / income × 100`, reported as `0` when there is no income to divide by.

**`GET /api/users/export`** streams a PDF built with PDFKit. It embeds `public/fonts/SpaceGrotesk-Regular.ttf` and **throws at startup if that file is missing**, so keep it committed.

---

## Settings

Two tables, deliberately separate.

### `user_settings` — per-account preferences

`key`/`value` rows grouped by category, defined once in `USER_SETTINGS` ([src/static/fallback.ts](src/static/fallback.ts)). `GET /api/users/settings` **reconciles** every account against that catalogue on each read: keys you add are created with their default, keys you remove are deleted. Adding or retiring a preference therefore needs no migration and no backfill script.

Every preference is read by something — none of them are decoration:

| Preference | Category | Where it takes effect |
| --- | --- | --- |
| `emailNotifications` | notifications | Master switch for email. While off, `weeklyReports` is disabled in the UI **and no notification email is built or sent** — every send passes the gate in [notifications.ts](src/lib/notifications.ts) first |
| `weeklyReports` | notifications | Whether the weekly summary email is sent by the digest job |
| `transactionAlerts` | notifications | Whether recording a transaction — manually, by quick entry, or by confirming a recurring suggestion — pops an on-screen confirmation **and sends a confirmation email**. Errors are never suppressed |
| `budgetAlerts` | notifications | Whether budgets approaching their limit are highlighted, and whether the budget-warning email is sent |
| `budgetAlertThreshold` | notifications | The percentage that counts as "approaching" on the budgets screen, the dashboard and the warning email, replacing the old hard-coded 80% |
| `recurringReminders` | notifications | Whether the dashboard shows the due/detected recurring banner, and whether the recurring-due email is sent |
| `language` | appearance | Interface locale. Applied to the route on sign-in, switched live from the picker, **and used to write every notification email** |
| `currency` | appearance | Currency every amount is converted to and displayed in, on screen and in emails |
| `theme` | appearance | Light, dark or follow the system |
| `dateFormat` | appearance | Pattern used by every date on the transactions and recurring screens, and in emails |
| `hideAmounts` | privacy | Masks every amount behind `••••••`. Enforced inside the currency provider, so it covers the whole app at once |
| `publicQuickBalances` | privacy | Whether the public quick-entry page may show your balances after your email is entered. **Off by default** — see [Quick entry](#quick-entry-without-signing-in) |
| `itemsPerPage` | general | Page size for the transactions and budgets lists |
| `defaultTransactionType` | general | Type — and matching default category — preselected when the add-transaction form opens |
| `recurringLookaheadDays` | general | How far ahead "upcoming" reaches, used by the recurring screen, the dashboard banner and the `/api/recurring` default |

Values are always stored as strings; `type` (`boolean`, `string`, `number`) tells the UI which control to render.

### Adding a preference

The settings screen is driven entirely by data — it renders a card per category and picks a control per row, so a new preference needs no UI code:

1. Add an entry to `USER_SETTINGS` with a `key`, default `value`, `type`, `category` and `icon`.
2. For a select, publish the choices as an app setting named `<snake_cased_key>_options` — `dateFormat` looks up `date_format_options` — and add the same list to `FALLBACK_OPTIONS` in [usePreferences.ts](src/hooks/usePreferences.ts) so it works before the seed runs.
3. Read it through `usePreferences()` on the client or `getUserPreferences()` on the server.
4. Optionally add `settingsPage.settings.<key>.title`/`.description` to the message files; without them the screen falls back to the humanised key and the description stored on the row.

A boolean renders as a toggle, a key with options renders as a select, and anything else renders as a plain input. `DEPENDS_ON` in [settings.tsx](src/layouts/ui/settings.tsx) marks a preference that a master switch disables.

### `app_settings` — instance-wide configuration

**`app_settings`** — instance-wide configuration, editable without a redeploy:

| Key                                                                                                       | Effect                                   |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `allow_registration`                                                                                      | Turns sign-ups on and off                |
| `maintenance_mode`                                                                                        | Refuses every write with `503`           |
| `max_accounts_per_user`                                                                                   | Cap enforced when creating an account    |
| `max_categories_per_user`                                                                                 | Cap enforced when creating a category    |
| `max_password_age_days`                                                                                   | Drives password expiry                   |
| `currency_options`, `language_options`, `theme_options`, `date_format_options`, `items_per_page_options`, `budget_alert_threshold_options`, `default_transaction_type_options`, `recurring_lookahead_days_options` | Choices offered by the matching preference — see [Adding a preference](#adding-a-preference) |
| `currency_locale_map`, `zero_decimal_currencies` | How each currency is formatted |
| `home_*`, `login_*`, `register_*`, `footer_copyright`, …                                                  | Landing-page and auth-screen copy        |
| `app_version`, `app_created`, `app_build_number`, `app_environment`                                       | Shown on the settings screen             |
| `recurring_*`, `weekly_report_days`, `quick_*_rate_limit`, `quick_rate_limit_window_seconds`              | The numbers the server behaves by — see [Tuning](#tuning) |

Rows flagged `isPublic` are exposed unauthenticated at `GET /api/settings`, which is how the landing and login pages get their text before anyone signs in. Values of type `json` are parsed before being returned.

### Editing them — the App Settings screen

`app_settings` decides how the whole instance behaves, so it is edited from **/admin/dashboard/app-settings** ([src/layouts/ui/app-settings.tsx](src/layouts/ui/app-settings.tsx)) and only by a **superadmin**. The screen groups every row by category, shows the internal ones the public endpoint hides, and creates, edits and deletes them live — the tuning cache is dropped on write, so a change takes effect on the next request rather than within the minute.

**The role.** `User.role` is `USER` or `SUPERADMIN`, and nothing in the UI grants it — there is deliberately no "make admin" button to find. The first one comes from the deploy:

```bash
# 1. register the account normally
# 2. name it in the environment
SUPERADMIN_EMAIL="you@example.com"
# 3. the seed promotes it (it runs on every deploy)
npm run db:seed
```

`requireSuperAdmin()` ([src/lib/get-user.ts](src/lib/get-user.ts)) re-reads the role from the database on every request instead of trusting the session, so a demotion takes effect immediately even though the JWT it was minted into is still valid. A signed-in non-superadmin gets `403`, kept distinct from `401` so a valid session is never bounced to the login screen. The sidebar entry is hidden for everyone else, but that is cosmetic — the API is the guard.

**What the screen will not let you do.** Keys in the seed catalogue ([src/static/app-settings.ts](src/static/app-settings.ts)) are marked *Built-in* and cannot be deleted: a feature reads each one by name, and the seed would recreate it on the next deploy anyway. Their values are freely editable. Values are validated against their declared type before they are stored, so a `number` row cannot come to hold `"abc"` and a `json` row must parse.

**Everything is audited.** `app_setting_audits` records the key, the action, the previous and new value, and who made the change — these rows are the behaviour of the instance, changed from a screen rather than a redeploy, so `git log` cannot answer "who set this to 0". `GET /api/app-settings/{key}` returns the last ten entries alongside the row.

> The production seed is **additive**: it creates keys a release added and leaves existing values exactly as configured. It used to wipe the table first, which would have silently undone every edit made here on every deploy.

### Tuning

No feature carries its own magic constant. Everything a maintainer might want to adjust lives in the `tuning` category of `app_settings` and is read through `getTuning()` ([src/lib/app-settings.ts](src/lib/app-settings.ts)), which caches for a minute and falls back to the catalogue in [src/static/app-settings.ts](src/static/app-settings.ts) if the database is unreachable:

| Key | Default | Governs |
| --- | --- | --- |
| `recurring_history_days` | `365` | How far back the detector reads |
| `recurring_min_occurrences` | `3` | Repeats before a pattern is suggested |
| `recurring_min_consistency` | `0.6` | Share of gaps that must match the interval |
| `recurring_min_confidence` | `55` | Score below which a pattern is discarded |
| `recurring_time_bucket_minutes` | `120` | Width of a daily slot — what keeps a morning and an evening habit apart |
| `recurring_due_email_limit` | `20` | Items listed in one reminder email |
| `weekly_report_days` | `7` | Window the weekly summary covers |
| `quick_lookup_rate_limit` | `20` | Public lookups per client per window |
| `quick_create_rate_limit` | `30` | Public writes per client per window |
| `quick_rate_limit_window_seconds` | `60` | Length of that window |

Change a row and the next request picks it up — no redeploy, no code change. Per-account defaults are a separate matter: those come from the `USER_SETTINGS` catalogue, and the client's `PREFERENCE_DEFAULTS` is derived from it rather than restated, so the value a new account is created with and the value the UI falls back to cannot drift apart.

---

## Notifications & email

Every email except the password reset answers to a preference. They all pass through one gate in [`src/lib/notifications.ts`](src/lib/notifications.ts):

```
mailer configured?  →  emailNotifications on?  →  this notification's own preference on?  →  build & send
```

Switching a preference off does not hide a message that was sent anyway — **the email is never built and the send never happens**. Each call returns why it stopped (`master-disabled`, `preference-disabled`, `not-configured`, `nothing-to-send`, `failed`), which is what the digest job counts.

| Email | Preference | Trigger |
| --- | --- | --- |
| Transaction recorded | `transactionAlerts` | Creating a transaction, a quick transaction, or confirming a recurring occurrence |
| Budget warning | `budgetAlerts` + `budgetAlertThreshold` | The expense that pushes a budget past the threshold — once per budget, not on every later transaction |
| Recurring due | `recurringReminders` | The digest job, for anything whose next occurrence has arrived |
| Weekly summary | `weeklyReports` | The digest job |
| Password reset | *(none)* | Transactional — always sent, since asking for it is the point |

Emails are written with the account's own settings: the `language` decides the wording (`emails` namespace in the message files), `currency` converts and formats the amounts, `dateFormat` writes the dates. All four share one layout in [`src/lib/mailer.ts`](src/lib/mailer.ts), so a new notification only describes its content.

The per-transaction emails are queued with `after()` so they never delay the API response or fail the request that triggered them.

### Scheduling the digest

The weekly summary and the recurring reminder need a scheduler — the app deliberately does not run its own. Point any cron at:

```bash
curl -X POST https://your-host/api/notifications/digest \
     -H "Authorization: Bearer $CRON_SECRET"
```

`?kind=weekly` or `?kind=recurring` runs one of them; the default runs both. A daily `recurring` and a weekly `weekly` is the usual pairing. The endpoint refuses with `503` when `CRON_SECRET` is unset and `401` on a wrong secret, and returns how many accounts were processed, sent and skipped.

Without `RESEND_API_KEY` the whole system no-ops cleanly — nothing throws, every send reports `not-configured`.

---

## Currency

Amounts are stored once, in `BASE_CURRENCY` (default `IDR`), and converted only for display. The currency provider reads the user's `currency` preference, fetches rates from `EXCHANGE_RATE_URL`, and formats with `Intl.NumberFormat` using a locale map from app settings. Zero-decimal currencies (JPY, IDR, …) are rendered without decimal places. Conversion routes through the base currency, so any pair works from a single rate table.

---

## Internationalisation & routing

### One place declares a language

[`src/static/locales.ts`](src/static/locales.ts) is the only file that names a locale. The i18n routing, the middleware, the `language_options` app setting and the language picker are all derived from it, so **adding a language is two steps**:

1. Drop a `messages/<code>.json` next to the existing files.
2. Add one entry to `LOCALE_DEFINITIONS`:

```ts
export const LOCALE_DEFINITIONS: LocaleDefinition[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "id", label: "Indonesia", flag: "🇮🇩" },
  { value: "zh", label: "Chinese", flag: "🇨🇳" },
  { value: "ja", label: "日本語", flag: "🇯🇵" }, // ← that's it
];
```

Nothing else hard-codes `"en" | "id" | "zh"`.

### What the UI actually reads

The language picker on the settings screen reads the **`language_options` app setting**, not a constant — so labels, flags and ordering can be changed per environment straight in the database, no redeploy. Two safeguards keep that from breaking the app:

- The list is filtered through `isSupportedLocale`, so a row naming a locale the build has no messages for is quietly skipped instead of throwing.
- If the row is missing entirely — a database seeded before the language existed — the picker falls back to the list derived from `LOCALE_DEFINITIONS`.

Because the locale set must be known to edge middleware and the messages must be in the bundle, the *set* of languages is a code-level decision while their *presentation* is data. That is as dynamic as next-intl allows without shipping message files over the wire.

### How a language is chosen

The `language` preference is the account's source of truth. [`LocaleSync`](src/providers/locale-provider.tsx) applies it once after the settings load, so signing in on a new device lands you in your own language; navigating to another locale by hand during the session is left alone. Changing the picker switches the route immediately and saves the preference in the same action.

### Routing

The middleware in [`src/proxy.ts`](src/proxy.ts) handles three cases:

- Public routes (`/`, `/login`, `/register`, the password screens) pass through unprefixed.
- `/admin/dashboard` is redirected to `/{locale}/admin/dashboard`, using the `NEXT_LOCALE` cookie when set and the default locale otherwise.
- Anything already carrying a locale prefix is handed to next-intl.

`/api`, `/_next` and any path containing a dot are excluded from the matcher entirely.

Adding a string means adding the same key to **every** message file — there is no runtime fallback between locales. The one exception is the settings screen, which falls back to the humanised key and the description stored on the row when a preference has no translation yet. Check parity with:

```bash
node -e "const k=o=>Object.entries(o).flatMap(([a,b])=>b&&typeof b=='object'?k(b).map(x=>a+'.'+x):[a]);\
const en=k(require('./messages/en.json'));\
for (const l of ['id','zh']) console.log(l, en.filter(x=>!k(require('./messages/'+l+'.json')).includes(x)));"
```

---

## Health & maintenance

**`GET /api/health`** runs `SELECT 1` against a `DATABASE_TIMEOUT_MS` deadline and reports `status`, `timestamp`, process `uptime` and the database latency, answering `503` when the database is unreachable. A cached variant (`HEALTH_CACHE_TTL_MS`) is used for internal checks so probes cannot hammer the database. This is the only route that does not use the standard envelope, because probes expect a plain body.

**Maintenance mode** is enforced by `withApi`, which wraps every route handler. `GET`, `HEAD` and `OPTIONS` pass straight through; anything else checks the `maintenance_mode` app setting first and returns `503` when it is on. Reads therefore keep working during maintenance. If that lookup itself fails the request is allowed through — a database blip must not read as "maintenance".

---

## Logging & tracing

Every route is wrapped in **`withApi`** ([`src/lib/api-handler.ts`](src/lib/api-handler.ts)), which gives each request an id and writes a `request.start` / `request.finish` pair around it. Handlers contain no `try`/`catch`: whatever they throw is classified, logged with its stack, and returned as a clean JSON error.

```ts
export const GET = withApi("accounts.list", async () => {
  const user = await requireAuth();
  return successResponse(await prisma.account.findMany({ where: { userId: user.id } }));
});

export const PUT = withApi<{ id: string }>("accounts.update", async (req, { params }) => {
  const { id } = await params;
  // …throwing here is fine — withApi maps and logs it
});
```

**One id ties everything together.** The id comes from the incoming `x-request-id` header when a proxy already set one, otherwise it is generated. It is returned on every response as `x-request-id` (alongside `x-response-time`), included in the body of every error, and — because it lives in an `AsyncLocalStorage` context — stamped automatically onto every log line written while that request runs, including Prisma queries and background email sends. `requireAuth` adds the `userId` to the same context, so lines written after sign-in carry it too.

**Logs are written to files, not to the terminal.** The app writes its own rotating files, so keeping history needs nothing installed — no shipper, no `docker logs` plumbing. The terminal stays clean.

```
logs/finarthax-2026-08-05.log         everything
logs/finarthax-error-2026-08-05.log   warn + error only, for triage
```

A new file starts each day, and once a file passes `LOG_FILE_MAX_SIZE_MB` (10 MB) it continues into `finarthax-2026-08-05.1.log`. Anything older than `LOG_FILE_RETENTION_DAYS` (14) is deleted at startup and once a day after that, so the disk cannot fill up unattended. Files are always JSON — one object per line — whatever `LOG_FORMAT` does to the terminal, because a file is read with `grep` and `jq`.

```bash
tail -f logs/finarthax-$(date +%F).log                    # follow everything
jq -r 'select(.level=="error")' logs/finarthax-error-*.log  # today's failures
grep 4f2c8b1e logs/*.log | jq .                           # one request, start to finish
```

Nothing here can take the app down. If the directory is not writable, file logging switches itself off, prints one `[logger] file logging disabled` notice, and **falls back to stdout** so the lines are never silently dropped — then the app keeps serving.

Set `LOG_TO_CONSOLE=true` to mirror everything to the terminal as well, which is what makes `docker logs` and `journalctl` show the app's logs again; it is off by default. Under Docker the log directory is a mounted volume (`./logs`), so the files are readable straight from the host — see the notes in [`docker-compose.yml`](docker-compose.yml).

**What gets logged.** `logger` ([`src/lib/logger.ts`](src/lib/logger.ts)) writes one JSON object per line to the files. `LOG_FORMAT` only affects the terminal mirror, where `pretty` gives readable colourised lines.

| Level   | What lands there                                                                       |
| ------- | -------------------------------------------------------------------------------------- |
| `debug` | Individual database queries, request bodies, per-step timings                            |
| `info`  | Request start/finish, domain events (`transactions.created`, `auth.login`, `users.deleted`) |
| `warn`  | `4xx` responses, slow requests and queries, rate limits, failed logins, maintenance blocks |
| `error` | `5xx` responses, database failures, email sends that failed, unhandled rejections          |

**Errors are classified, not guessed.** `Unauthorized` → `401`, `ZodError` → `422` with field errors, Prisma `P2002` → `409`, `P2025` → `404`, malformed JSON → `400`. Anything unrecognised is a `500` whose message is replaced with a generic one in production — the real message and stack stay in the logs, and the client gets the request id to quote. In development the real message is returned, because that is more useful than a lookup.

**Secrets never reach the logs.** Any field whose name looks like a password, token, secret, api key, authorization header, cookie, cvv, otp or pin is replaced with `***redacted***`; emails are masked to `he***@gmail.com`; long strings and large arrays are truncated and cycles broken. Redaction is recursive, so it applies to request bodies and Prisma arguments too.

**Slow things surface on their own.** A request over `LOG_SLOW_REQUEST_MS` (default 1s) is logged at `warn` with `slow: true`; a query over `LOG_SLOW_QUERY_MS` (default 300ms) is logged at `warn` with its model, operation and arguments.

**Nothing is lost outside a request.** [`src/instrumentation.ts`](src/instrumentation.ts) logs server start and shutdown, catches `unhandledRejection` and `uncaughtException`, and hooks Next's `onRequestError` so failures in server components and page renders are captured in the same format.

Configuration lives in [`.env.example`](.env.example) under **Logging** and **Log files**. The defaults are already correct per environment — nothing has to be set for production to work. The one worth knowing is `LOG_REQUEST_BODY`, which is off in production and can be switched on temporarily while chasing a bug.

On the browser side, a failed call from `apiClient` throws an **`ApiError`** carrying `status` and `requestId`, so the UI can show the user the same id you will grep for.

---

## API documentation

An OpenAPI 3.1 specification covering all 48 operations ships with the app.

| What              | Where                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Swagger UI        | [`/api-docs`](http://localhost:3000/api-docs)                                                             |
| Raw specification | [`/openapi.json`](http://localhost:3000/openapi.json) — also [`public/openapi.json`](public/openapi.json) |

**Testing protected endpoints:** sign in at `/login` in the same browser, then open `/api-docs` and press **Try it out**. The page sends requests with `credentials: "include"`, so your NextAuth session cookie goes along automatically — there is no token to paste.

The same file imports directly into **Postman** (_Import → File → `public/openapi.json`_), **Insomnia**, or the online **Swagger Editor**, and can generate clients with `openapi-generator`.

Prefer the terminal? Grab the session cookie from your browser's dev tools:

```bash
COOKIE='next-auth.session-token=…'

curl -s http://localhost:3000/api/recurring -H "Cookie: $COOKIE"

curl -s -X POST http://localhost:3000/api/transactions \
  -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d '{"type":"EXPENSE","accountId":"clx…","categoryId":"cly…","amount":45000,"description":"Lunch","date":"2026-07-31T12:30:00.000Z"}'
```

Endpoints needing no session at all — handy for a first smoke test:

```bash
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/settings
```

Keep [`public/openapi.json`](public/openapi.json) updated when you add or change a route; it is the contract the docs page renders.

> `/api-docs` is served in every environment. If you would rather not expose it publicly, delete [`src/app/api-docs/route.ts`](src/app/api-docs/route.ts) or return `404` from it when `NODE_ENV === "production"`.

---

## API reference

All responses share one envelope:

```jsonc
{
  "success": true,
  "message": "Success",
  "data": {
    /* ... */
  },
}
```

Validation failures return `422` with an `errors` map keyed by field name. Non-`GET` routes return `503` while maintenance mode is on. Protected routes return `401` without a session.

### Public

| Method | Endpoint                    | Description                              |
| ------ | --------------------------- | ---------------------------------------- |
| `POST` | `/api/auth/register`        | Create an account                        |
| `POST` | `/api/auth/forgot-password` | Email a reset link                       |
| `POST` | `/api/auth/reset-password`  | Complete a reset                         |
| `*`    | `/api/auth/[...nextauth]`   | NextAuth handlers                        |
| `GET`  | `/api/settings`             | Public app settings                      |
| `GET`  | `/api/quick-transactions`   | Look up accounts and categories by email |
| `POST` | `/api/quick-transactions`   | Record a transaction without a session   |
| `GET`  | `/api/health`               | Liveness/readiness probe                 |
| `POST` | `/api/notifications/digest` | Sends the scheduled emails. Needs `Authorization: Bearer $CRON_SECRET`, not a session |

### Protected

| Method          | Endpoint                        | Description                                       |
| --------------- | ------------------------------- | ------------------------------------------------- |
| `GET` `POST`    | `/api/accounts`                 | List and create accounts                          |
| `PUT` `DELETE`  | `/api/accounts/{id}`            | Update and delete                                 |
| `GET` `POST`    | `/api/transactions`             | List (filtered, paginated) and create             |
| `PUT` `DELETE`  | `/api/transactions/{id}`        | Update and delete, reversing balances             |
| `GET`           | `/api/recurring`                | Due, upcoming, detected and dismissed suggestions |
| `PATCH`         | `/api/recurring/{id}`           | Start or stop tracking a series                   |
| `POST`          | `/api/recurring/{id}/confirm`   | Log the proposed occurrence                       |
| `POST`          | `/api/recurring/{id}/skip`      | Advance the schedule without logging              |
| `POST` `DELETE` | `/api/recurring/{id}/dismiss`   | Dismiss or restore a detected pattern             |
| `GET` `POST`    | `/api/categories`               | List and create categories                        |
| `PUT` `DELETE`  | `/api/categories/{id}`          | Update and delete                                 |
| `GET` `POST`    | `/api/budgets`                  | List and upsert budgets                           |
| `PUT` `DELETE`  | `/api/budgets/{id}`             | Change the cap, delete                            |
| `GET` `POST`    | `/api/goals`                    | List and create goals                             |
| `PUT` `DELETE`  | `/api/goals/{id}`               | Update and delete                                 |
| `PATCH`         | `/api/goals/{id}/progress`      | Set progress, auto-completing the goal            |
| `GET`           | `/api/dashboard/summary`        | Balances, monthly totals, recent activity         |
| `GET`           | `/api/dashboard/charts`         | Chart series and budget progress                  |
| `GET`           | `/api/reports/monthly`          | Monthly report                                    |
| `GET`           | `/api/reports/yearly`           | Yearly report                                     |
| `POST`          | `/api/reports/custom`           | Custom date-range report                          |
| `GET` `PUT`     | `/api/users/profile`            | Read and update the profile                       |
| `POST`          | `/api/users/change-password`    | Change password                                   |
| `GET`           | `/api/users/export`             | Export transactions as PDF                        |
| `DELETE`        | `/api/users/delete`             | Delete the account and all its data               |
| `GET`           | `/api/users/settings`           | User preferences                                  |
| `PATCH`         | `/api/users/settings/{key}`     | Update one preference                             |
| `GET`           | `/api/imagekit/upload-auth`     | Signed upload credentials                         |
| `DELETE`        | `/api/imagekit/delete/{fileId}` | Remove an uploaded file                           |

### Superadmin

Every route below answers `403` to a signed-in account whose `role` is not `SUPERADMIN`. See [the App Settings screen](#editing-them--the-app-settings-screen).

| Method          | Endpoint                    | Description                                                             |
| --------------- | --------------------------- | ----------------------------------------------------------------------- |
| `GET`           | `/api/app-settings`         | Every `app_settings` row, internal ones included. Query: `category`, `search` |
| `POST`          | `/api/app-settings`         | Create a setting                                                        |
| `GET`           | `/api/app-settings/{key}`   | One setting plus its last ten audit entries                             |
| `PATCH`         | `/api/app-settings/{key}`   | Update value, type, category, label, description, order or visibility   |
| `DELETE`        | `/api/app-settings/{key}`   | Delete a custom setting — `409` for a built-in one                      |

#### `GET /api/recurring`

Query: `lookaheadDays` (1–90, default 14), `historyDays` (30–1095, default 365), `minOccurrences` (2–12, default 3).

```jsonc
{
  "summary": {
    "dueCount": 2,
    "upcomingCount": 3,
    "detectedCount": 4,
    "trackedCount": 6,
    "monthlyCommitted": 2450000, // monthly cost of tracked recurring expenses
    "monthlyPotential": 780000, // monthly cost of detected but untracked ones
  },
  "due": [
    /* ScheduledRecurrence — status OVERDUE or DUE_TODAY */
  ],
  "upcoming": [
    /* ScheduledRecurrence within lookaheadDays */
  ],
  "detected": [
    /* DetectedPattern, highest confidence first */
  ],
  "dismissed": [
    /* DetectedPattern you chose to hide */
  ],
}
```

Pass `due[].transactionId` or `detected[].transactionId` as `{id}` to the other recurring endpoints.

---

## Data model

| Model               | Purpose                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `User`              | Account holder, `role` (`USER` / `SUPERADMIN`), password policy timestamps, avatar        |
| `UserSetting`       | Per-user preferences, unique on `(userId, key)`                                           |
| `AppSetting`        | Instance-wide flags, limits and public copy, unique on `key`                              |
| `AppSettingAudit`   | Who changed which `app_settings` row, and what it held before                             |
| `VerificationToken` | Hashed password-reset tokens with an expiry                                               |
| `Account`           | Cash / bank / e-wallet / credit card / investment, with balance and optional credit limit |
| `Transaction`       | Income, expense or transfer, plus the recurrence fields above                             |
| `Category`          | Income or expense category                                                                |
| `Budget`            | Monthly cap and running spend, unique on `(userId, categoryId, month, year)`              |
| `Goal`              | Savings target with progress and status                                                   |

Money is `Decimal(15, 2)` throughout — never a float. Deleting a user cascades to every account, transaction, category, budget, goal and setting they own.

Balances and budget spend are never recomputed from scratch at read time; they are adjusted incrementally inside the same database transaction that writes the ledger row, and reversed on edit or delete.

---

## Environment variables

Start from [`.env.example`](.env.example) — it carries this same list with placeholder values and is the one env file that gets committed. Add a variable there whenever you add one to the code, so a fresh clone is never missing a setting.

| Variable                     | Required | Default                             | Purpose                                          |
| ---------------------------- | -------- | ----------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`               | ✅       | —                                   | PostgreSQL connection string                     |
| `NEXTAUTH_URL`               | ✅       | —                                   | Public base URL used by NextAuth and reset links |
| `NEXTAUTH_SECRET`            | ✅       | —                                   | JWT signing secret                               |
| `SESSION_EXPIRATION`         |          | `900`                               | Session lifetime in seconds                      |
| `GOOGLE_CLIENT_ID`           |          | —                                   | Enables Google sign-in                           |
| `GOOGLE_CLIENT_SECRET`       |          | —                                   | Enables Google sign-in                           |
| `RESEND_API_KEY`             |          | —                                   | Enables email; without it every send is skipped  |
| `RESEND_EMAIL_FROM`          |          | `Finarthax <onboarding@resend.dev>` | Sender address                                   |
| `CRON_SECRET`                |          | —                                   | Bearer token required by the digest endpoint     |
| `SUPERADMIN_EMAIL`           |          | —                                   | Account the seed promotes to `SUPERADMIN`, the only role that can open App Settings |
| `IMAGEKIT_PUBLIC_KEY`        |          | —                                   | Avatar uploads                                   |
| `IMAGEKIT_PRIVATE_KEY`       |          | —                                   | Avatar uploads                                   |
| `IMAGEKIT_UPLOAD_EXPIRE_SEC` |          | —                                   | Upload token lifetime, capped at 3600            |
| `BASE_CURRENCY`              |          | `IDR`                               | Currency amounts are stored in                   |
| `BASE_CURRENCY_SYMBOL`       |          | `Rp`                                | Symbol for the base currency                     |
| `EXCHANGE_RATE_URL`          |          | exchangerate-api                    | Source for conversion rates                      |
| `DATABASE_TIMEOUT_MS`        |          | `5000`                              | Deadline for the health-check query              |
| `HEALTH_CACHE_TTL_MS`        |          | `10000`                             | How long a health result is cached               |
| `LOG_LEVEL`                  |          | `debug` dev / `info` prod           | `debug`, `info`, `warn` or `error`               |
| `LOG_FORMAT`                 |          | `pretty` dev / `json` prod          | Terminal mirror only; files are always JSON      |
| `LOG_SERVICE_NAME`           |          | `finarthax`                         | Stamped on every line; log filename prefix       |
| `LOG_SLOW_REQUEST_MS`        |          | `1000`                              | Requests above this are logged at `warn`         |
| `LOG_SLOW_QUERY_MS`          |          | `300`                               | Queries above this are logged at `warn`          |
| `LOG_REQUEST_BODY`           |          | `true` dev / `false` prod           | Mirror JSON bodies into the logs (redacted)      |
| `LOG_TO_FILE`                |          | `true`                              | Write rotating log files                         |
| `LOG_TO_CONSOLE`             |          | `false`                             | Also mirror to stdout                            |
| `LOG_DIR`                    |          | `logs`                              | Where the log files go                           |
| `LOG_FILE_MAX_SIZE_MB`       |          | `10`                                | Roll over once a file passes this size           |
| `LOG_FILE_RETENTION_DAYS`    |          | `14`                                | Delete log files older than this                 |
| `ENV_ENCRYPTION_KEY`         |          | —                                   | Opens an encrypted `.env`; see below             |

The Docker image additionally needs `POSTGRES_HOST`, `POSTGRES_PORT` and `POSTGRES_USER` for its readiness loop, and docker-compose creates the database from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`.

### Encrypting .env

**This is required, not optional.** The app refuses to start while `.env` holds plain values, and says which ones:

```
.env holds 17 value(s) in plain text: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, +14 more
This app only runs with an encrypted .env. Seal it with:
  npm run env:key   # once, if you have no .env.key yet
  npm run encrypt
```

The check looks at the **file**, not the environment. A container gets its settings from the orchestrator — Kubernetes secrets, `docker run -e`, compose `env_file` — and carries no `.env` of its own, so there is nothing to police and it starts normally. On any machine where `.env` does exist, it has to be sealed.

Values are sealed with AES-256-GCM:

```bash
npm run env:key      # write .env.key (once) — refuses to overwrite an existing key
npm run encrypt      # seal every plain value
npm run decrypt      # open them again
npm run env:status   # list which keys are sealed, and whether a key was found
```

Only the values change — keys, comments, blank lines and ordering are untouched, so the file still reads like a `.env`:

```env
# Database configuration
DATABASE_URL=enc:v1:+6tImv5CSbnpFf46XcbTnrBtDws5A/ftcCBVzCC/ALMB95SwVdvYhKGF…
```

`loadEncryptedEnv()` is called from [next.config.ts](next.config.ts) and [prisma.config.ts](prisma.config.ts), both evaluated before application code. It enforces the rule above, then opens anything sealed that Next or dotenv already put in `process.env`.

Each value gets its own random IV, so encrypting twice never produces the same ciphertext, and `encrypt` skips values that are already sealed rather than double-wrapping them. A wrong key fails loudly and writes nothing; an encrypted file with **no** key refuses to boot instead of starting with garbage settings.

**The key.** `npm run env:key` writes `.env.key` (git-ignored). On a server, pass the same value as `ENV_ENCRYPTION_KEY` instead of shipping the file — that is the arrangement that actually buys you something, since the key then lives somewhere the `.env` does not. A generated 32-byte key is used directly; any other string is stretched with scrypt, so a passphrase works too.

Worth being clear about what this does and does not protect:

- ✅ A `.env` copied, backed up, emailed or accidentally committed is useless on its own.
- ✅ Values are sealed individually, so a diff shows *which* setting changed without leaking it.
- ❌ It is **not** protection against someone who can read the whole project directory — `.env.key` sits right there. Keep the key in the environment (or a secret manager) on anything that matters.
- ⚠️ Lose the key and the values are gone. Run `npm run decrypt` before rotating it, and keep `.env.key` backed up somewhere safe.

Two practical notes: `encrypt`/`decrypt` leave a `.env.bak` holding the previous contents — delete it once you are happy, since after encrypting it still holds the plaintext. And restart a running dev server afterwards: Next reloads `.env` when it changes but does not re-run the config that decrypts it, so it would otherwise keep serving with sealed values.

`NEXT_PUBLIC_*` variables should stay in plain text — they are inlined into the client bundle at build time and are public by definition. This project has none.

---

## Scripts

| Script                | Description                  |
| --------------------- | ---------------------------- |
| `npm run dev`         | Development server           |
| `npm run build`       | Production build             |
| `npm run start`       | Serve the production build   |
| `npm run lint`        | ESLint                       |
| `npm run typecheck`   | `tsc --noEmit`               |
| `npm run db:migrate`  | Create and apply a migration |
| `npm run db:validate` | Check the migration history is safe to deploy |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed`     | Seed the database            |
| `npm run db:studio`   | Open Prisma Studio           |
| `npm run db:reset`    | Drop, re-migrate and re-seed |
| `npm run encrypt`     | Seal the values in `.env`    |
| `npm run decrypt`     | Open the values in `.env`    |
| `npm run env:status`  | Show which values are sealed |
| `npm run env:key`     | Write a new `.env.key`       |

---

## Deployment

> **Deploying to a real server?** [DEPLOYMENT.md](DEPLOYMENT.md) is a start-to-finish Ubuntu guide — firewall, Postgres, TLS, systemd or Docker, the scheduled digest, backups and a troubleshooting table. The rest of this section is the short version.

### Docker Compose

```bash
cp .env.example .env     # fill it in first
docker compose up -d
```

Brings up PostgreSQL and the app on port 3000, reading configuration from `.env`. The container waits for PostgreSQL, then `entrypoint.sh` applies the newest folder in `prisma/migrations` with `psql`, recording it in a `__manual_migrations` table so it runs only once.

That means **the migration must be committed to the image** — generate it locally with `npm run db:migrate` before building.

The compose file pulls `helmyyy/finarthax:latest` by default and also carries a `build:` block, so `docker compose build app` produces the same image locally. Both the image and the compose service expose a healthcheck against `/api/health`, so `docker ps` reports real readiness rather than "the process started".

**Scheduled emails.** The weekly summary and the recurring-due reminder need something to call the digest endpoint. A `digest` service is included behind a profile so it stays off unless you ask for it:

```bash
docker compose --profile scheduler up -d
```

It runs `busybox crond` inside the network and calls the app at 07:00 daily (`kind=recurring`) and 08:00 on Mondays (`kind=weekly`). It needs `CRON_SECRET` set in `.env`; without it the endpoint answers `503` and nothing is sent.

**Encrypted .env.** If you sealed the file with `npm run encrypt`, pass the key through the environment rather than putting it back in `.env`:

```bash
ENV_ENCRYPTION_KEY="$(cat .env.key)" docker compose up -d
```

`entrypoint.sh` opens the sealed values before it runs the migration, because that step shells out to `psql` and needs `DATABASE_URL` in plain text long before `next.config.ts` gets a chance to decrypt anything. It only does this when it sees a sealed value, and fails with a clear message if the key is missing.

**Secrets are no longer part of the build.** `.dockerignore` now excludes every `.env*` except the template, so credentials cannot end up in an image layer. `prisma generate` and `next build` still want a `DATABASE_URL`, so the builder stage sets a placeholder — neither of them connects to a database, and the placeholder does not survive into the final image. Configure the container at run time instead, through `env_file`, `-e`, or your orchestrator's secret store.

### Kubernetes

Manifests in [k8s/](k8s/) cover the namespace, config map, secret, PostgreSQL (with a PV/PVC), the app deployment and service, an ingress, and the digest CronJobs:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
```

Before applying, set the real values in [k8s/secret.yaml](k8s/secret.yaml) — at minimum `NEXTAUTH_SECRET`, `POSTGRES_PASSWORD` and `CRON_SECRET`, plus `RESEND_API_KEY` if you want email. Everything non-secret lives in [k8s/configmap.yaml](k8s/configmap.yaml): the public URL, currency defaults, session lifetime and the health-probe budget.

`/api/health` backs both the liveness and readiness probes. Note that `DATABASE_TIMEOUT_MS` and `HEALTH_CACHE_TTL_MS` are now set explicitly in the config map — an unset timeout used to fall back to a 0 ms deadline, which fails the check instantly and restarts a perfectly healthy pod.

**Digest CronJobs.** [k8s/digest-cronjob.yaml](k8s/digest-cronjob.yaml) defines two jobs that POST to the digest endpoint with the shared `CRON_SECRET`:

| Job | Schedule | Sends |
| --- | --- | --- |
| `finarthax-digest-recurring` | 07:00 daily | Recurring transactions that are due |
| `finarthax-digest-weekly` | 08:00 Mondays | The week-in-review summary |

Both use `concurrencyPolicy: Forbid` so a slow run is never overlapped, and both still pass every account's notification preferences — the schedule only decides *when* the app is asked, never *who* receives. Adjust `timeZone` for your deployment, and trigger one by hand with:

```bash
kubectl create job --from=cronjob/finarthax-digest-recurring manual-run -n finarthax
kubectl logs job/manual-run -n finarthax
```

### Continuous deployment to a VPS (native Node + systemd)

Two workflows in [.github/workflows/](.github/workflows/) cover the path DEPLOYMENT.md calls Path B. The runner never builds the artifact that gets served and never touches the database: it verifies the commit, then asks the server to deploy that exact SHA. The server builds, migrates, restarts and health-checks itself.

| Workflow | Runs on | Does |
| --- | --- | --- |
| [ci.yml](.github/workflows/ci.yml) | every push and PR | lint, typecheck, build, and the migration checks below |
| [deploy.yml](.github/workflows/deploy.yml) | push to `main`, or manually | calls `ci.yml`, then runs [scripts/deploy.sh](scripts/deploy.sh) on the server over SSH |

**Migration validation.** `migrate deploy` applies whatever it finds and records a checksum per migration, which makes two edits quietly fatal: changing a migration that has already run (every later deploy then fails with P3009), and changing `schema.prisma` without generating one (the deploy succeeds, the column is missing, the failure lands at runtime). `npm run db:validate` ([scripts/validate-migrations.ts](scripts/validate-migrations.ts)) refuses both, plus:

| Check | Why |
| --- | --- |
| A committed migration was modified, renamed or deleted | Its checksum no longer matches what the database recorded |
| `schema.prisma` changed with no new migration | `migrate deploy` only applies what is committed |
| A `migration.sql` that `.gitignore` would swallow | The folder exists locally and never reaches the server — this repo's `*.sql` rule did exactly that until `!prisma/migrations/**/*.sql` was added |
| Destructive SQL — `DROP TABLE`/`COLUMN`, `TRUNCATE`, a type change, `SET NOT NULL` | Unrecoverable without a restore. Allowed deliberately with the `allow-destructive-migration` PR label or `ALLOW_DESTRUCTIVE_MIGRATIONS=true` |
| `ADD COLUMN … NOT NULL` with no default | Fails outright on a table that already holds rows |
| Duplicate timestamps, malformed names, empty migrations | Two branches generating in the same second order arbitrarily on the server |
| The migrations do not replay into `schema.prisma` | The definitive check — needs `SHADOW_DATABASE_URL`, which CI provides |

CI then replays the whole history onto an empty database exactly as the server will, runs the seed **twice** to prove it is idempotent, and diffs the result against the schema.

**Deploying.** [scripts/deploy.sh](scripts/deploy.sh) runs on the VPS as the service user:

```
fetch → checkout SHA → npm ci → prisma generate → build
      → pg_dump (only if migrations are pending) → migrate deploy → db seed
      → systemctl restart → wait for /api/health → roll back if it never comes up
```

Build first, restart last: the old version keeps serving for the minute or two the build takes, so the only downtime is the restart. If the new version fails its health check the script rebuilds the previous commit and restarts it. Migrations are **not** reversed — that is what the pre-deploy dump in `/var/backups/finarthax` is for, and the failure message points at it.

Run it by hand for a manual release or a rollback:

```bash
sudo -u finarthax APP_DIR=/opt/finarthax/app scripts/deploy.sh main
sudo -u finarthax APP_DIR=/opt/finarthax/app scripts/deploy.sh --rollback-to <sha>
```

**Setting it up.** The service user needs a passwordless rule for the one privileged step:

```bash
echo 'finarthax ALL=(root) NOPASSWD: /bin/systemctl restart finarthax' | sudo tee /etc/sudoers.d/finarthax-deploy
sudo chmod 440 /etc/sudoers.d/finarthax-deploy
```

Then add the repository secrets:

| Secret | Required | Value |
| --- | --- | --- |
| `VPS_HOST`, `VPS_USER` | ✅ | Server and the service user that owns the checkout |
| `VPS_SSH_KEY` | ✅ | Private key whose public half is in that user's `authorized_keys` |
| `VPS_SSH_KNOWN_HOSTS` | ✅ | `ssh-keyscan -H <host>` — pinned from a secret, never scanned at run time, so the host key is not trusted sight unseen |
| `VPS_PORT`, `VPS_APP_DIR`, `VPS_SERVICE_NAME` | | Default to `22`, `/opt/finarthax/app`, `finarthax` |
| `APP_PUBLIC_URL` | | Smoke-tested from the runner after the deploy — the health endpoint itself is loopback-only |

A manual run (**Actions → Deploy → Run workflow**) takes a `ref` to deploy, or a `rollback_to` SHA which skips verification.

### Releasing

`release.ps1` (Windows) builds and pushes the Docker image, then tags the Git release.

---

## Conventions

- **Routes never catch their own errors.** Every handler is wrapped in `withApi`, which owns the request id, the logging, the maintenance gate and the error mapping. A `try`/`catch` inside a route means something genuinely local is being handled — like the PDF renderer in `users/export` — not routine error plumbing.
- **Validation is shared.** A Zod schema in `src/types/validations` is the single definition of a payload; routes parse with it and return `validationErrorResponse` on failure.
- **Money maths lives on the server.** `applyBalanceChange` and `applyBudgetChange` are the only places balances move, and they always run inside `prisma.$transaction`.
- **Client bundles stay clean.** Anything a client component needs — interval lists, currency options, icons — lives in `src/static`, never in `src/lib`, which pulls in Prisma and NextAuth.
- **Screens are one file.** Each dashboard page is a single component in `src/layouts/ui`, with its route file doing nothing but rendering it.
- **Dates are datetimes.** Every date input in the app is `datetime-local` and every value crosses the wire as an ISO string, so an occurrence recorded at 09:00 stays at 09:00.
