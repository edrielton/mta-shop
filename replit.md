# MTA Server Store

## Overview

MTA Server Store is a gaming e-commerce platform for selling virtual items, VIP memberships, vehicles, and in-game currency for MTA (Multi Theft Auto) game servers. The platform features automated activation of purchases directly to the game server, Stripe payment processing, and an admin dashboard for managing products and transactions.

The application follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database using Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite with HMR support
- **Theme**: Dark/light mode with CSS variables

Key pages:
- Home (landing page with product showcase)
- Products catalog with filtering
- Product detail with checkout
- User dashboard
- Admin panel for product/user/transaction management
- Authentication (login/register)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: express-session with connect-pg-simple for PostgreSQL session storage
- **Authentication**: Custom session-based auth with bcrypt password hashing
- **API Pattern**: RESTful endpoints under `/api/*`

Key API routes:
- `/api/auth/*` - Authentication (login, register, logout, session check)
- `/api/products/*` - Product CRUD operations
- `/api/checkout/*` - Stripe checkout session creation and verification
- `/api/admin/*` - Admin-only operations
- `/api/mta/*` - MTA server integration settings

### Data Storage
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **ORM**: Drizzle ORM with Zod schema validation
- **Schema Location**: `shared/schema.ts`

Core tables:
- `users` - User accounts with MTA serial/account linking, VIP status, coin balance
- `products` - Store items with MTA command configuration
- `transactions` - Purchase history with Stripe integration
- `systemLogs` - Audit logging
- `mtaSettings` - MTA server connection configuration

### MTA Server Integration
The platform is designed to communicate with MTA game servers via HTTP endpoints:
- Configurable server URL, port, and authentication token
- MTA commands are stored per-product for automated activation
- Transaction completion triggers MTA server API calls

### Build & Development
- **Development**: `npm run dev` - runs tsx for hot reloading
- **Production Build**: `npm run build` - uses esbuild for server, Vite for client
- **Database Migrations**: `npm run db:push` - Drizzle Kit push to database

## External Dependencies

### Payment Processing
- **Stripe**: Payment processing via Stripe Checkout
  - Configured through Replit Connectors for development/production environments
  - Webhook handling for payment confirmation
  - Supports Brazilian Real (BRL) currency

### Database
- **PostgreSQL**: Primary database
  - Connection via `DATABASE_URL` environment variable
  - Session storage with `connect-pg-simple`

### MTA Server Communication
- HTTP-based API calls to MTA game server
- Requires MTA server to expose HTTP endpoints
- Token-based authentication between web store and game server

### UI Component Library
- **shadcn/ui**: Full component library based on Radix UI primitives
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, tabs, etc.)
- **Lucide React**: Icon library

### Form & Validation
- **react-hook-form**: Form state management
- **Zod**: Schema validation (shared between frontend and backend)
- **drizzle-zod**: Generate Zod schemas from Drizzle tables

## Development Data

The database is seeded with sample data for testing:

### Test Credentials
- **Admin User**: username: `admin`, password: `admin123`
  - Full admin access to all management features

### Sample Products (12 items)
- VIP subscriptions (7 days, 30 days, permanent)
- Vehicles (sports car, helicopter, motorcycle)
- Coin packages (10k, 50k, 100k)
- Items (skin, weapon kit, property)

### MTA Settings
- Default configuration created (inactive by default)
- Configure via Admin Panel → MTA Settings tab
- Set server URL, port, and API token

## Production Setup

### Required Environment Variables
- `SESSION_SECRET`: Strong secret for session encryption (REQUIRED for production)
- `DATABASE_URL`: PostgreSQL connection string (auto-configured on Replit)

### Stripe Configuration
The Stripe connector is installed. For production:
1. Ensure Stripe keys are configured via Replit Connectors
2. Set up webhook endpoint at `/api/checkout/webhook`
3. Configure webhook to listen for `checkout.session.completed` events

### MTA Server Integration
1. Copy the `mta_resource/` folder to your MTA server's `resources/` directory as `mta_store`
2. Edit `mta_store/config.lua` and set `MTA_STORE_TOKEN` to a secure secret
3. Start the resource: `start mta_store`
4. In the website Admin Panel → MTA Settings:
   - Server URL: `http://IP_DO_SERVIDOR`
   - Server Port: `22005`
   - API Token: same value as `MTA_STORE_TOKEN` in config.lua
5. The site will send activations to: `http://IP:22005/mta_store/activate`

### MTA Resource (mta_resource/)
Located at the project root as a **separate deliverable** — copy it to the MTA server, NOT to the website folder.

Files:
- `meta.xml` — Resource definition; registers the HTTP page
- `config.lua` — Token & behavior settings (edit this)
- `server.lua` — Command handlers (giveVip, giveCar, giveCoins, giveSkin, giveWeaponKit, giveProperty) + offline queue
- `activate.lua` — HTTP page; validates token + HMAC, dispatches commands
- `queue.json` — Persists offline activations across server restarts

Supported product commands: `giveVip`, `giveCar`, `giveVehicle`, `giveCoins`, `giveSkin`, `giveWeaponKit`, `giveProperty`