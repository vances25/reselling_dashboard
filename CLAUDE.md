# Reselling Dashboard — Project Context

## What this project is
A full-stack order management dashboard for eBay reselling, built for two users (me and a friend). Tracks inventory from sourcing → listing → sold, calculates profit, and shows combined + individual analytics.

## Tech stack
- Next.js 14 App Router (TypeScript)
- MongoDB + Mongoose (hosted on MongoDB Atlas)
- NextAuth.js (credentials provider, JWT sessions)
- Tailwind CSS + shadcn/ui
- lucide-react for icons

## Project structure
```
/app                  → Next.js App Router pages
/app/api              → Route handlers
/app/(auth)/login     → Login page
/app/dashboard        → Main orders table
/app/dashboard/analytics → Charts & user comparisons
/app/dashboard/inventory → Active inventory view
/components           → Shared UI components
/lib/models           → Mongoose models (User, Order)
/lib/db.ts            → MongoDB connection singleton
/lib/auth.ts          → NextAuth config
/scripts/seed.ts      → Seed script for users + sample data
```

## Key business rules — never break these

### Soft delete
- Orders are NEVER hard deleted from MongoDB
- Deleting sets `deletedAt: Date` on the document
- All list/filter queries default to `{ deletedAt: null }`
- Financial totals (profit, revenue) always include ALL orders, even deleted ones
- There is a "show deleted" toggle in analytics only

### Profit formula
```
profit = soldPrice - purchaseCost - shippingCost - platformFees
platformFees defaults to soldPrice * 0.13 (eBay ~13%)
projectedProfit = listPrice - purchaseCost - (listPrice * 0.13)  // for Listed items
```

### Multi-user rules
- Both users can VIEW all orders from both accounts
- Users can only EDIT or DELETE their own orders
- The `owner` field on every Order is a ref to User
- Analytics shows combined totals AND per-user breakdown side by side

### Order statuses (in order)
Sourced → Listed → Sold → Archived

## Database models summary

### User
`name, email, passwordHash, createdAt`

### Order
`orderId, platform (eBay/Depop/Facebook/Other), productName, buyerUsername, purchaseCost, sourceDate, sourceLocation, listPrice, soldPrice, shippingCost, platformFees, profit (virtual), status, location, notes, trackingNumber, photos[], owner (ref User), deletedAt, createdAt, updatedAt`

## API routes
```
GET    /api/orders              list with filters + pagination
POST   /api/orders              create order
GET    /api/orders/[id]         single order
PATCH  /api/orders/[id]         update order
DELETE /api/orders/[id]         soft delete (set deletedAt)
GET    /api/analytics           aggregated stats
POST   /api/seed                seed users + sample data (dev only)
```

## UI conventions
- Main table: dense/compact rows (~44px), Excel-like feel
- Status badges: Sourced=gray, Listed=blue, Sold=green, Archived=amber
- Platform badges: eBay=blue, Depop=pink, Facebook=teal, Other=gray
- Owner avatars: colored circle with initials (e.g. "ME", "FR")
- Profit column: green if positive, red if negative, dash if no soldPrice
- Sidebar: 220px dark sidebar, collapses to hamburger on mobile
- Inline editing: double-click cells to edit (soldPrice, status, trackingNumber at minimum)
- Bulk actions: checkboxes → Mark Sold / Archive / Delete

## Environment variables needed
```
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

## Seed users
- User 1: name "Me", email me@dashboard.local, password: changeme123
- User 2: name "Friend", email friend@dashboard.local, password: changeme123
Seed also creates 10 sample orders spread across both users, platforms, and statuses.

## Death pile rule
If a user has 10+ orders with status "Sourced" (unlisted), show a warning banner on the Inventory page.

## Code style preferences
- TypeScript strict mode
- Async/await over .then()
- Zod for API input validation
- Keep API route handlers thin — business logic in /lib/
- Use server components where possible, client components only when needed (forms, interactive table)
- Error boundaries on every page
- Loading skeletons for table and charts
