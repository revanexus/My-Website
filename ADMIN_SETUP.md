# Reva Nexus V11 — Admin Control Center

## Initial admin credentials
No real admin username or password is stored in this repository.

Set these only in your private `.env` before starting the server:
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `SESSION_SECRET`

Never commit `.env` to GitHub.

## Dashboard capabilities
- Manage AI Agents from Supabase `public.ai_agents`
- Manage Arabic / English / French agent translations through `public.ai_agent_translations`
- Configure per-language voice IDs using V11 voice tables
- Create, edit and publish digital products through `public.products`
- Manage multilingual pages through `public.pages` + `public.page_sections`
- Upload images/videos to S3/R2 through the protected media endpoint
- Manage influencers/media records
- Manage admin accounts and roles
- Review the V11 audit log
- Export a safe JSON backup

The old `Content` editor has been removed. Page editing is now backed by `pages` and `page_sections`.
