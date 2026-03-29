# Openlier

Openlier is an open-source AI YouTube thumbnail generator built with Next.js.
It supports prompt-based generation, optional style references from YouTube links, credit-based usage, and Stripe checkout.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Better Auth (GitHub OAuth)
- PostgreSQL (`pg`)
- Stripe (checkout + webhook)
- Google Gemini (prompt safety + image generation)
- AWS S3 (image storage)
- Zustand + Tailwind CSS

## Quick Start

### 1) Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database
- GitHub OAuth app
- Stripe account
- Google AI Studio key + YouTube Data API key
- AWS S3 bucket and IAM credentials

### 2) Install

```bash
pnpm install
```

### 3) Configure environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB_NAME

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

GOOGLE_AI_STUDIO_API_KEY=
YOUTUBE_API_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=

# Optional: set to "true" to enable real image generation.
# If false/missing, API returns a placeholder image for local testing.
GENERATE_IMAGES=true
```

Note: Better Auth can also require `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` depending on your runtime/deployment setup.

### 4) Database setup (manual SQL migrations)

This repository currently uses raw SQL queries and expects business tables to exist.
There is no versioned migration folder in this repo right now.

At minimum, ensure these tables exist in your database:

- `thumbnail_session`
- `thumbnail_generation`
- `credit_purchase`
- `konami_redemption`

The auth `user` table is managed by Better Auth.

### 5) Run locally

```bash
pnpm dev
```

Open http://localhost:3000 and sign in with GitHub.

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build production bundle
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Main API Routes

- `POST /api/generate` - Validate/enrich prompt and generate thumbnail
- `GET /api/sessions` - List user sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get generations for a session
- `DELETE /api/sessions/:id` - Delete session
- `GET /api/images/:id` - Resolve signed image URL / blob stream
- `POST /api/stripe/checkout` - Create Stripe checkout session
- `POST /api/stripe/confirm` - Confirm checkout result
- `POST /api/stripe/webhook` - Stripe webhook handler
- `GET /api/youtube/channel` - Fetch channel-based style references
- `GET /api/youtube/video` - Fetch video metadata/thumbnail
- `POST /api/konami` - One-time bonus credits
- `GET/POST /api/auth/[...all]` - Better Auth endpoints

## Basic Flow

1. User signs in with GitHub.
2. User creates a session.
3. User submits prompt (+ optional references).
4. API deducts 1 credit and runs Gemini safety/enrichment.
5. If enabled, image is generated and uploaded to S3.
6. Generation metadata is stored in PostgreSQL.

## Deploy (generic Node/Next.js)

1. Set all environment variables in your hosting platform.
2. Provision PostgreSQL and run your manual SQL setup before first request.
3. Expose a public HTTPS URL for `POST /api/stripe/webhook` and configure it in Stripe.
4. Build and run:

```bash
pnpm build
pnpm start
```

## Troubleshooting

- `401 Unauthorized`: verify session/auth cookies and GitHub OAuth config.
- `Error generating image`: verify `GOOGLE_AI_STUDIO_API_KEY` and `GENERATE_IMAGES=true`.
- Stripe webhook errors: verify `STRIPE_WEBHOOK_SECRET` and raw-body signature handling.
- YouTube lookup failures: verify `YOUTUBE_API_KEY` and quota.
- Missing image previews: verify S3 credentials, bucket name, and region.
- DB relation errors: required business tables are missing.
