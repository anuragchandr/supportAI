# SupportAI

**Knowledge-based customer support for business websites.**

SupportAI is a full-stack SaaS-style application that lets a business create a workspace, add its own knowledge documents, embed a support chat widget on its website, review saved conversations, and view contact details submitted through the widget.

> **Project status:** Active development. The core application flows are implemented, but the project should be treated as pre-production until deployment configuration, security review, abuse controls, and automated tests are complete.

## Contents

- [What it does](#what-it-does)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [How retrieval-augmented generation works](#how-retrieval-augmented-generation-works)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database and Prisma](#database-and-prisma)
- [Run the application](#run-the-application)
- [Use SupportAI](#use-supportai)
- [Install the website widget](#install-the-website-widget)
- [API reference](#api-reference)
- [Security notes](#security-notes)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Current limitations and next steps](#current-limitations-and-next-steps)

## What it does

### Workspace and authentication

- Self-service account registration with a business workspace.
- Email/password sign-in and sign-out.
- Password hashing using `bcryptjs`.
- Signed JWT session stored in an HTTP-only cookie.

### Business knowledge base

- Add text documents to a business workspace.
- Split document text into overlapping chunks.
- Generate embeddings using Cloudflare Workers AI.
- Store embeddings in PostgreSQL with `pgvector`.
- Search only the current business's processed document chunks.

### AI support chat

- Ask questions from the dashboard or website widget.
- Retrieve semantically relevant knowledge chunks before generating an answer.
- Return source references when available.
- Abstain when the knowledge base does not provide relevant information rather than intentionally inventing business facts.
- Save chat messages and conversation history in the database.

### Website widget

- Generate a widget key for a business.
- Configure allowed website origins.
- Embed the standalone JavaScript widget into a website.
- Ask questions and submit contact details from the widget.
- Validate the configured origin and apply database-backed rate limits to public widget requests.

### Workspace views

- Dashboard overview.
- Knowledge Base document management.
- Dashboard AI Chat.
- Website Widget settings and embed instructions.
- Conversation Inbox and conversation transcripts.
- Lead Inbox for contact details submitted through the widget.

## Technology stack

| Area | Technology |
|---|---|
| Web framework | Next.js App Router |
| Language | TypeScript |
| UI | React and Tailwind CSS |
| ORM | Prisma |
| Database | PostgreSQL; Supabase PostgreSQL is used in the current setup |
| Vector search | `pgvector` with cosine-similarity search and an HNSW index |
| Embeddings | Cloudflare Workers AI, `@cf/baai/bge-small-en-v1.5` (384 dimensions) |
| Answer generation | Cloudflare Workers AI, `@cf/google/gemma-4-26b-a4b-it` |
| Authentication | JWT, HTTP-only cookies, `bcryptjs` password hashing |
| Website integration | Standalone JavaScript file served from `public/supportai-widget.js` |

The model names above match the current source code. Availability, limits, pricing, and model support are controlled by the provider and can change. Review provider documentation before deployment.

## Architecture

```text
Business owner
    |
    v
Next.js workspace -----------------------> PostgreSQL / Prisma
    |                                          |
    | add knowledge document                  | users, businesses,
    v                                          | documents, conversations,
Text chunking                                  | messages, leads
    |
    v
Cloudflare Workers AI embeddings
    |
    v
pgvector document chunks

Website visitor
    |
    v
public/supportai-widget.js
    |
    v
/api/widget/chat?key=...  -----> validate widget key + Origin
    |                              and apply rate limit
    v
Embed question --> business-scoped pgvector search
    |
    v
Cloudflare Workers AI answer generation
    |
    +----> return answer and source references
    |
    +----> save conversation and messages

Website visitor --> /api/widget/leads --> Lead record
```

## How retrieval-augmented generation works

1. A business owner adds a document in the Knowledge Base page.
2. SupportAI splits its text into chunks. The current chunker targets approximately 700 characters per chunk with 100 characters of overlap, preferring natural text boundaries where possible.
3. Cloudflare Workers AI generates a 384-dimensional embedding for each chunk. The ingestion process batches embedding requests.
4. PostgreSQL stores the chunks and their vectors. The application uses `pgvector` cosine similarity to find relevant passages.
5. When a customer asks a question, SupportAI embeds the question and searches only documents belonging to that business that have `PROCESSED` status.
6. Relevant passages are included in the prompt sent to the chat model. The response can include source markers referencing the retrieved documents.
7. The question and answer are stored in the conversation history.

Retrieval thresholds and result counts are currently configured in the source code. They are implementation settings, not a guarantee that every answer is correct. Test the assistant against real business documents before using it with customers.

## Repository structure

```text
supportAI/
├── public/
│   ├── supportai-widget.js       # Embeddable customer chat widget
│   └── widget-demo.html          # Local widget test page
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/             # Register, login, logout, current user
│   │   │   ├── chat/             # Authenticated RAG chat and retrieval
│   │   │   ├── documents/        # Document APIs
│   │   │   └── widget/           # Public chat/leads and widget settings
│   │   ├── dashboard/
│   │   │   ├── chat/
│   │   │   ├── conversations/    # Inbox and transcript pages
│   │   │   ├── knowledge/        # Knowledge Base UI
│   │   │   ├── leads/            # Lead Inbox UI
│   │   │   └── widget/           # Widget settings UI
│   │   ├── login/
│   │   ├── register/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx              # Public landing page + documentation
│   ├── lib/
│   │   ├── ai/                   # Cloud AI embedding and generation calls
│   │   ├── rag/                  # Chunking, ingestion, retrieval
│   │   ├── auth.ts               # Current-user/session helper
│   │   └── db.ts                 # Shared Prisma client
│   └── prisma/
│       ├── migrations/
│       └── schema.prisma
├── compose.yml                   # Optional local pgvector PostgreSQL
├── next.config.ts
├── package.json
└── README.md
```

Some paths may change as the project evolves. Check the current source tree if a path differs on your branch.

## Prerequisites

- Node.js **20.9 or newer** (required by Next.js 16).
- npm.
- A PostgreSQL database with `pgvector` enabled. Supabase PostgreSQL is the current hosted option.
- A Cloudflare account and Workers AI API token with permission to run the configured AI models.
- Git for version control.

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/anuragchandr/supportAI.git
cd supportAI
npm install
```

### 2. Configure environment variables

Create a file named `.env` in the project root. Use the template in [Environment variables](#environment-variables) below and put your own values in it.

**Never commit `.env` or paste secrets into source code.** The repository's `.gitignore` ignores `.env*` files.

### 3. Generate Prisma Client

```bash
npm run db:generate
```

### 4. Apply database migrations

For a development database:

```bash
npm run db:migrate
```

This runs Prisma's development migration workflow using `src/prisma/schema.prisma`. The migration set creates the application tables, enables `pgvector`, adds the embedding column and vector index, and adds the public widget configuration and rate-limit table.

If your hosted database refuses the extension migration, enable the `vector` extension using your database provider's supported extension controls, then rerun or resolve migrations according to Prisma's migration state. Do not manually delete or rewrite migration history on a database containing data.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional: use the included local PostgreSQL container

`compose.yml` starts a local PostgreSQL 16 database image with `pgvector`; it does **not** start the Next.js application.

```bash
docker compose up -d db
```

The default local-only connection uses host port `5433`, database `supportai`, user `supportai`, and the password configured in `compose.yml`. You can use that connection for `DATABASE_URL` and `DIRECT_URL` during local development. Do not reuse the local example credentials in production. If you already use Supabase, you do not need this container.

## Environment variables

Create `.env` in the repository root. Do not publish real values in your README, GitHub commits, screenshots, or client-side code.

```dotenv
# PostgreSQL connection used by Prisma at runtime.
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# Connection Prisma uses for direct operations/migrations.
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# Long, random signing secret; use at least 32 characters.
JWT_SECRET="replace-with-a-long-random-secret"

# Cloudflare Workers AI credentials used only on the server.
CLOUDFLARE_ACCOUNT_ID="your-cloudflare-account-id"
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
```

### Notes for Supabase PostgreSQL

- Copy connection strings from your own Supabase project's database connection settings.
- In the current setup, `DATABASE_URL` is intended for the runtime pooler and `DIRECT_URL` for a migration-compatible direct/session connection. Use the connection modes and parameters provided for your Supabase project and Prisma version; do not blindly copy credentials from an example.
- Keep both connection strings private. Do not prefix them with `NEXT_PUBLIC_`.
- `pgvector` must be available in the database for document embedding and similarity search.

### Generate a strong JWT secret

PowerShell or a terminal with Node.js installed:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy the generated value into `JWT_SECRET` in `.env`. The same secret must be configured in each app instance that verifies the same sessions. Rotate it if it has been exposed; rotation invalidates existing sessions.

No `NEXT_PUBLIC_*` AI credentials are required. Cloudflare credentials must remain server-side.

## Database and Prisma

The Prisma schema is located at `src/prisma/schema.prisma`.

| Model | Purpose |
|---|---|
| `User` | Account identity, email, password hash, and role |
| `Business` | Workspace owned by a user, including widget key and allowed origins |
| `Document` | Business knowledge document and processing status |
| `DocumentChunk` | Text chunks and 384-dimensional embedding vectors |
| `Conversation` | Chat session associated with a business and optional visitor ID |
| `Message` | User, assistant, or system message belonging to a conversation |
| `Lead` | Contact details submitted through the widget, optionally linked to a conversation |
| `WidgetRateBucket` | Database-backed request counter/window for a business widget |

Useful commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

Use `npm run db:migrate` only for development workflows. For a deployment using the committed migrations, run the production migration command as part of the release process:

```bash
npx prisma migrate deploy --schema=src/prisma/schema.prisma
npm run db:generate
```

Back up production data before deploying schema changes.

## Run the application

```bash
# Development server
npm run dev

# Lint
npm run lint

# Production build
npm run build

# Run a previously built application
npm run start
```

`npm run start` expects a successful production build first. At this stage there is no dedicated automated unit/integration-test script configured in `package.json`.

## Use SupportAI

1. Open `/register` and create an account with a name, business name, email, and password. A business workspace is created with the account.
2. Sign in at `/login` if needed.
3. Open **Knowledge Base** and add accurate business information.
4. Verify that the document status becomes `PROCESSED` after ingestion succeeds.
5. Use **AI Chat** to test questions whose answers are present in your documents.
6. Open **Website Widget** and configure allowed website origins, then generate a widget key.
7. Copy the exact snippet shown by the workspace and install it on your test website.
8. Test a widget conversation and contact submission. Confirm that the transcript appears in Conversation Inbox and the contact appears in Lead Inbox.

Use test data when validating the workflow. Do not enter personal information from real customers into a development instance unless you have permission and appropriate safeguards.

## Install the website widget

### 1. Configure the origin

In the authenticated dashboard, open **Website Widget**. Add the website origin that is allowed to use the widget.

Examples:

```text
https://example.com
http://localhost:3000
```

An origin includes the protocol and hostname, plus a non-default port when applicable. Do not include a page path such as `/contact` or `/pricing`. Production websites should use HTTPS. HTTP is allowed only for localhost development by the current settings route.

### 2. Generate the snippet

Save the allowed origins and generate a widget key. Copy the exact embed snippet from the dashboard. It follows this pattern:

```html
<script
  src="https://YOUR-SUPPORTAI-DOMAIN/supportai-widget.js"
  data-widget-key="YOUR_WIDGET_KEY"
  defer
></script>
```

The domain and key above are placeholders. Replace them by copying the actual code from your SupportAI workspace. Add it immediately before the closing `</body>` tag where practical.

### 3. Verify it

- Reload the customer website and verify the launcher appears.
- Ask a question covered by the business knowledge base.
- Ask a question that is not covered and verify the assistant abstains instead of inventing a policy.
- Submit a test contact form.
- Confirm the conversation is saved in Conversation Inbox and the contact appears in Lead Inbox.

### Local widget demo

The repository contains `public/widget-demo.html`. When the app is running locally, it can be opened at [http://localhost:3000/widget-demo.html](http://localhost:3000/widget-demo.html). Configure the corresponding localhost origin in Widget Settings and use the current snippet/key from your local workspace. Do not rely on an old hard-coded demo key; rotate it if it points to a real workspace and replace committed demo values with placeholders before sharing the repository.

## API reference

The main application endpoints currently include:

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Create account and business workspace; starts a session |
| `POST` | `/api/auth/login` | Public | Sign in and set the session cookie |
| `POST` | `/api/auth/logout` | Session cookie | Clear the session cookie |
| `GET` | `/api/auth/me` | Session cookie | Return the current user/workspace |
| `GET` | `/api/documents` | Session cookie | List business documents |
| `POST` | `/api/documents` | Session cookie | Create and ingest a text document |
| `DELETE` | `/api/documents/[documentID]` | Session cookie | Delete a document belonging to the current business |
| `POST` | `/api/chat` | Session cookie | Generate a knowledge-grounded chat answer and save the conversation |
| `POST` | `/api/chat/retrieve` | Session cookie | Return semantic retrieval matches for debugging/testing |
| `GET` | `/api/widget/settings` | Session cookie | Read widget configuration |
| `POST` | `/api/widget/settings` | Session cookie | Save allowed origins or generate/rotate a widget key |
| `POST` | `/api/widget/chat?key=...` | Widget key + allowed `Origin` | Public widget chat, subject to origin checks and rate limiting |
| `OPTIONS` | `/api/widget/chat?key=...` | Widget key + allowed `Origin` | Widget CORS preflight |
| `POST` | `/api/widget/leads?key=...` | Widget key + allowed `Origin` | Submit a lead from the widget, subject to origin checks and rate limiting |

The public widget endpoints are intended to be called by the browser widget. They validate the configured widget key and `Origin` against the business allowlist. CORS and an origin header are not substitutes for a comprehensive anti-abuse system: non-browser clients can forge headers, and rate limiting is currently per business rather than a full per-IP/per-visitor abuse-control platform.

## Security notes

- `JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`, and `CLOUDFLARE_API_TOKEN` are secrets. Keep them in server-side environment variables only.
- Passwords are hashed using `bcryptjs`; the original password is not stored.
- The session cookie is HTTP-only, uses `SameSite=Lax`, and is marked `Secure` in production.
- Application queries should remain scoped to the authenticated business. Do not remove business ownership filters to work around missing records.
- The widget key is visible in website source because it is part of the embed snippet. Treat it as a public widget identifier, not as a server secret. Restrict allowed origins and rotate a key if you need to invalidate an existing installation.
- The public widget applies database-backed per-business rate limiting. This is a basic control, not a substitute for stronger abuse prevention, provider limits, monitoring, and budget controls.
- Keep `.env` out of Git. If a database password, JWT secret, or provider token was ever committed or shared, rotate it; deleting it from the latest file is not enough.
- Before public production use, add and test suitable signup abuse protection, email verification or an equivalent account policy, backup/recovery procedures, monitoring, and a security review.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production application |
| `npm run start` | Serve a successful production build |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma Client using the project's schema path |
| `npm run db:migrate` | Run Prisma's development migration workflow |
| `npm run db:studio` | Open Prisma Studio |

## Troubleshooting

### `Cloudflare Workers AI is not configured`

Check that `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are present in the server `.env` file. Restart the development server after changing environment variables. Do not expose the token in client-side code.

### `pgvector is not enabled` or vector type errors

Confirm the database has the `vector` extension enabled and the embedding migration has completed. Review Prisma migration status before attempting manual schema changes.

### Widget returns `403`

Confirm that the widget key belongs to the expected business and that the requesting website's exact origin is present in its allowed origins. Scheme, hostname, and port must match. Check the browser Network panel for the failed request, but do not share a live widget key publicly in issue reports.

### Widget chat or lead submission returns `404`

Confirm the app version deployed includes both `/api/widget/chat` and `/api/widget/leads`. Verify that the URL is the SupportAI server's domain, not the customer's website domain.

### A conversation transcript returns `404`

Open the conversation from the current workspace's Conversation Inbox first. The detail route intentionally returns not found when the conversation does not belong to the current business. Keep dynamic route folder names consistent, for example `[conversationId]`, along the same route segment.

### Signup says an email already exists

Use another email for testing or sign in with the existing account. The email address has a unique database constraint.

## Current limitations and next steps

- Automated unit, integration, and end-to-end tests are not yet configured as a full test suite.
- Self-service registration currently does not provide a complete email-verification or password-reset flow.
- AI responses can still be wrong; maintain good knowledge documents, test retrieval, and review customer-facing behavior.
- The per-business rate limiter is basic and does not replace a robust production abuse-control service.
- Billing, subscription management, service-level guarantees, and a production operations runbook are not implemented here.
- Do not assume the application is production-ready solely because local flows work. Run lint/build checks, test critical ownership boundaries, deploy with separate production secrets, and test the widget on an HTTPS website.

## References

- [Next.js documentation](https://nextjs.org/docs)
- [Prisma documentation](https://www.prisma.io/docs)
- [Supabase documentation](https://supabase.com/docs)
- [Cloudflare Workers AI documentation](https://developers.cloudflare.com/workers-ai/)
- [pgvector](https://github.com/pgvector/pgvector)

---

Built as an actively developed project. Features, implementation details, model availability, and setup instructions may change as SupportAI evolves.
