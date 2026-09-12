# Reva Nexus V11 — Production

Production-ready foundation for the trilingual Reva Nexus website.

## Included
- Arabic + English + French public content
- PostgreSQL-backed content, AI Agents, Influencers, Pages and Admin sessions
- Admin login with roles: owner, editor, media, viewer
- Audit log and JSON backup/restore
- Cloud/S3-compatible media storage (Cloudflare R2 recommended)
- Influencer image uploads
- Influencer video uploads (MP4/WebM/MOV, up to 80 MB through the included server route)
- Public influencer video playback
- Future Pages manager: create, edit, draft/publish and delete pages without redeploying
- Future pages support EN/AR/FR title and body content and public URLs such as `/p/about-us`
- Docker + PostgreSQL local production-like stack
- Nginx reverse proxy configuration
- HTTPS-ready deployment notes

## Recommended production architecture
Cloudflare DNS/HTTPS → VPS (Docker: Node.js + PostgreSQL) → Cloudflare R2 for images/videos.

## Important
1. Copy `.env.example` to `.env` and replace every placeholder.
2. Never publish `.env`, real passwords, access keys or certificates in the repository.
3. Change the seed owner password before opening the site publicly.
4. For large video libraries, a future enhancement is direct browser-to-R2 multipart uploads so the VPS does not buffer video files.

## Admin
Open `/admin` after deployment. Use the owner account created from `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD`.

## Future Pages
The Pages tab is designed for future expansion. Create a page with a slug, choose draft/published state, enter EN/AR/FR titles and bodies, save it, and publish later when ready. Public URLs use `/p/<slug>`.
