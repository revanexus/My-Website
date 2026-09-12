# GitHub + Supabase deployment

## 1. Upload to GitHub
Upload the repository contents. Do NOT upload `.env` or real credentials.

## 2. Create Supabase database
Open the Supabase SQL Editor and run:

`supabase/schema.sql`

This creates the Reva Nexus V11 master schema, including the six public AI agents, products, prompts, orders, entitlements, pages, conversations, tasks and RLS foundation.

## 3. Configure the website
Copy `.env.example` to `.env` and set:
- DATABASE_URL
- SESSION_SECRET
- ADMIN_SEED_EMAIL
- ADMIN_SEED_PASSWORD
- S3/R2 variables if media uploads are needed

Never expose a Supabase `service_role` key in browser code.

## 4. Run
```bash
npm install
npm start
```

## 5. Production
Use a managed PostgreSQL/Supabase database and put the Node server behind HTTPS/reverse proxy.

## Security checklist
- `.env` is intentionally excluded by `.gitignore`.
- Do not commit real passwords, API keys, Supabase service-role keys, R2/S3 secrets, certificates, or private keys.
- Use `.env.example` only as a configuration template.
- If a secret was ever committed previously, rotate it before publishing the repository.
