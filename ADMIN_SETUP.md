# Reva Nexus V11 — Real Admin

## Run on Windows
1. Install Node.js LTS.
2. Double-click `OPEN_REVA_NEXUS_V11.bat`.
3. The site opens at `http://localhost:3000/`.
4. Admin opens at `http://localhost:3000/admin`.

## Initial admin credentials
No real admin username or password is stored in this repository.

Set these only in your private `.env` file before starting the server:
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `SESSION_SECRET`

**Never commit `.env` to GitHub.**

## What is now server-backed
- Admin login with session cookie
- Content editing in Arabic / English / French
- Publish changes for all visitors
- Add/edit/delete AI Agents
- Add/edit/delete AI Influencers
- Upload influencer images (PNG/JPEG/WebP/GIF, max 8MB)
- Full JSON backup/restore

## Production
For a public deployment, use HTTPS and a reverse proxy. For multi-server deployments, move sessions and JSON data to a database/object storage.
