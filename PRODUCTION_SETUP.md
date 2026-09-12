# Reva Nexus V11 — Production Architecture

## Included
- PostgreSQL persistence for content, agents, influencers, admins and audit logs
- S3-compatible cloud image storage (Cloudflare R2 / AWS S3 / compatible)
- Secure session cookies + PostgreSQL session store
- bcrypt password hashing
- Helmet security headers
- Login rate limiting
- Multiple admin accounts with roles:
  - owner: full access, admin management, deletion, audit
  - editor: content + AI agent editing
  - media: influencer/media management
  - viewer: login/read-only access
- Audit log
- Docker + PostgreSQL compose
- Nginx HTTPS reverse-proxy template

## First deployment
1. Copy `.env.example` to `.env`.
2. Set a strong `SESSION_SECRET`.
3. Set `DATABASE_URL`.
4. Create an S3/R2 bucket and configure the five S3 variables.
5. Set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD`.
6. Run `docker compose up -d --build`.
7. Put Nginx/your hosting proxy in front of port 3000.
8. Issue a TLS certificate (for example with Certbot) and enable HTTPS.
9. Open `/admin` and create additional admin users from the owner account.

## Important
This package does not contain real cloud credentials or a real domain/certificate. Those are deployment secrets and must be supplied by the site owner.

## Recommended production setup
- Managed PostgreSQL (Neon, Supabase, RDS, etc.)
- Cloudflare R2 or AWS S3 + CDN
- Cloudflare/managed TLS or Let's Encrypt
- Daily PostgreSQL backups + object-storage versioning
- Strong password + optional VPN/IP restriction for `/admin`

## Future Pages
The Admin panel includes a Pages section for creating future public pages without redeploying the app. Each page supports English, Arabic and French title/body fields, draft/published status, and a clean public URL at `/p/<slug>`. Pages are stored in PostgreSQL and can be published later.

## Media
Influencer media uploads support images and MP4/WebM/MOV video files up to 150 MB. Files are stored in S3-compatible object storage (Cloudflare R2 recommended), while URLs are stored in PostgreSQL.
