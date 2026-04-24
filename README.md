## Bench Readiness (MVP)

Internal AI interview & assessment platform scaffold with:
- SSO login (generic OIDC)
- Role-based access control for **Engineer / Bench Manager / Talent / Practice Lead / Compliance**
- Core MVP screens (setup → interview → observer → review/sign-off)
- Prisma + SQLite persistence

## Getting Started

### 1) Configure env

Copy `.env.example` to `.env` and fill:
- `AUTH_SECRET`
- `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`
- Optional: `SSO_ROLE_MAP_JSON` to map IdP `roles`/`groups` → app roles

### 2) Set up the database

```bash
npx prisma migrate dev
```

### 3) Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Notes

- **SSO role mapping**: the app looks for an array claim named `roles` and/or `groups`. If a value matches one of our role names (e.g. `BENCH_MANAGER`) it will be used; otherwise it will map using `SSO_ROLE_MAP_JSON`.
- **RBAC routes**:
  - Engineer: `/engineer`, `/interview/:id`
  - Bench Manager: `/admin/*`, `/observer/*`
  - Talent: `/talent` (and can access `/admin/*` for setup/review in MVP)
  - Practice Lead: `/practice` (and can access `/admin/*`, `/observer/*` in MVP)
  - Compliance: `/compliance`

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
