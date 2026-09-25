# CareerVerify

Privacy-first employment verification platform.

## MVP
CareerVerify provides a permanent Career ID, employee and employer workspaces, consent-based employment verification, QR verification foundations, disputes and audit-ready data structures.

## Setup
Copy `.env.example` to `.env.local`, configure PostgreSQL and `AUTH_SECRET`, then run `npm install`, `npx prisma generate`, `npx prisma migrate dev --name init`, and `npm run dev`.

Aadhaar and PAN are not public identifiers and must never be exposed through Career ID lookup or QR verification.
