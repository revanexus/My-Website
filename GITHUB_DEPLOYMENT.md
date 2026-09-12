# GitHub + Supabase deployment

## 1. Upload to GitHub
Upload the repository contents. Do NOT upload `.env` or real credentials.

## 2. Create the Supabase database
Open the Supabase SQL Editor and run:

`supabase/schema.sql`

This creates the Reva Nexus V11 master schema, including the six seeded public AI agents, products, voice tables, pages, page sections, orders, entitlements, conversations, tasks and RLS foundation. It also creates the small `ai_agent_translations` extension used by the dashboard for Arabic/English/French agent presentation text.

## 3. Configure the private environment
Copy `.env.example` to `.env` and set the real values privately:
- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- S3/R2 variables if media uploads are needed

Never expose a Supabase `service_role` key in browser code.

## 4. Run
```bash
npm install
npm start
```

## 5. Admin dashboard
Open `/admin` after the server starts. The dashboard controls:
- AI Agents + multilingual text + voice IDs
- Digital Products
- Pages + page sections
- Images/videos + influencers
- Admin accounts
- Audit log
- Backup export

## 6. Voice
The database is prepared for per-language voices through `ai_agent_voices` and `agent_voice_settings`. The public demo also includes browser speech playback. A production AI voice provider can be connected server-side later without exposing its API key to the browser.

## Security checklist
- `.env` is excluded by `.gitignore`.
- Do not commit real passwords, API keys, Supabase service-role keys, R2/S3 secrets, certificates, or private keys.
- Use `.env.example` only as a configuration template.
- If a secret was ever committed previously, rotate it before publishing the repository.
