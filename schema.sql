
-- ============================================================
-- REVA NEXUS V11 — SQL V2 MASTER
-- Scalable multilingual / multi-tenant / AI-agent platform
-- Target: Supabase PostgreSQL
-- ============================================================
-- IMPORTANT:
-- 1) Run this script in a new Supabase project/database first.
-- 2) This schema prepares the platform for agents, voice,
--    channels, ads, podcasts, prompts, products, courses,
--    applications, orders, leads, bookings, YouTube and pages.
-- 3) Production authentication should use Supabase Auth.
-- 4) Never expose the Supabase service_role key in the browser.
-- 5) Paid prompt content is intentionally NOT public.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ------------------------------------------------------------
-- 1. LOOKUP TABLES
-- ------------------------------------------------------------

create table if not exists public.languages (
    code text primary key,
    name text not null,
    native_name text not null,
    is_active boolean not null default true,
    sort_order integer not null default 0
);

insert into public.languages(code,name,native_name,sort_order) values
('ar','Arabic','العربية',1),
('en','English','English',2),
('fr','French','Français',3)
on conflict (code) do update set
    name=excluded.name,
    native_name=excluded.native_name,
    sort_order=excluded.sort_order;

create table if not exists public.channel_types (
    code text primary key,
    name text not null,
    description text,
    is_active boolean not null default true
);

insert into public.channel_types(code,name,description) values
('website','Website','Reva Nexus website/chat'),
('whatsapp','WhatsApp','WhatsApp Business / Cloud API'),
('instagram','Instagram','Instagram messaging'),
('facebook','Facebook','Facebook/Messenger'),
('telegram','Telegram','Telegram Bot'),
('linkedin','LinkedIn','LinkedIn messaging/integration'),
('email','Email','Email channel'),
('api','API','External API clients')
on conflict (code) do nothing;

create table if not exists public.product_types (
    code text primary key,
    name text not null
);

insert into public.product_types(code,name) values
('digital','Digital Product'),
('prompt','Prompt'),
('course','Course'),
('application','Application'),
('service','Service'),
('subscription','Subscription'),
('other','Other')
on conflict (code) do nothing;

create table if not exists public.agent_task_types (
    code text primary key,
    name text not null,
    description text,
    is_active boolean not null default true
);

insert into public.agent_task_types(code,name,description) values
('general','General Task','Generic agent execution'),
('ad_campaign_generate','Advertising Campaign','Generate an advertising campaign'),
('ad_creative_generate','Ad Creative','Generate ad copy/creative data'),
('podcast_generate','Podcast','Generate podcast content'),
('podcast_episode_generate','Podcast Episode','Generate an episode'),
('sales_followup','Sales Follow-up','Sales lead follow-up'),
('lead_qualify','Lead Qualification','Qualify a lead'),
('content_generate','Content Generation','Generate website/social content'),
('translation','Translation','Translate content'),
('voice_transcribe','Voice Transcription','Speech to text'),
('voice_synthesize','Voice Synthesis','Text to speech'),
('human_handoff','Human Handoff','Escalate to a human'),
('webhook','Webhook','External webhook task')
on conflict (code) do nothing;

create table if not exists public.message_types (
    code text primary key,
    name text not null
);

insert into public.message_types(code,name) values
('text','Text'),
('voice','Voice'),
('image','Image'),
('video','Video'),
('audio','Audio'),
('file','File'),
('location','Location'),
('interactive','Interactive'),
('system','System')
on conflict (code) do nothing;

create table if not exists public.task_statuses (
    code text primary key,
    name text not null
);

insert into public.task_statuses(code,name) values
('queued','Queued'),
('running','Running'),
('completed','Completed'),
('failed','Failed'),
('cancelled','Cancelled')
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 2. TENANTS / ADMINS / MEMBERS
-- ------------------------------------------------------------

create table if not exists public.tenants (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    default_language text not null default 'ar' references public.languages(code),
    preferred_timezone text not null default 'Asia/Baghdad',
    status text not null default 'active',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.admins (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid unique,
    tenant_id uuid references public.tenants(id) on delete set null,
    email text unique not null,
    display_name text,
    role text not null default 'viewer'
        check (role in ('owner','editor','media','viewer')),
    is_active boolean not null default true,
    password_hash text, -- legacy/temporary only; prefer Supabase Auth
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    auth_user_id uuid not null,
    role text not null default 'viewer'
        check (role in ('owner','editor','media','viewer')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, auth_user_id)
);

-- ------------------------------------------------------------
-- 3. AI AGENTS
-- ------------------------------------------------------------

create table if not exists public.ai_agents (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    code text not null,
    name text not null,
    slug text not null,
    description text,
    system_prompt text,
    default_language text not null default 'ar' references public.languages(code),
    supported_languages text[] not null default array['ar','en','fr'],
    voice_enabled boolean not null default true,
    voice_provider text,
    default_voice_id text,
    default_voice_language text references public.languages(code),
    voice_settings jsonb not null default '{}'::jsonb,
    capabilities jsonb not null default '{}'::jsonb,
    status text not null default 'draft'
        check (status in ('draft','published','archived')),
    is_public boolean not null default false,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, slug)
);

insert into public.ai_agents
(tenant_id,code,name,slug,description,status,is_public,sort_order)
values
(null,'REVA_MAIN','Reva Nexus AI','reva-main','General Reva Nexus assistant','published',true,1),
(null,'REVA_MEDICAL','Medical AI Agent','medical','Medical and aesthetic/cosmetic information assistant','published',true,2),
(null,'REVA_REALTY','Realty AI Agent','realty','Real estate assistant','published',true,3),
(null,'REVA_HOTELS','Hotel AI Agent','hotels','Hotels and resorts assistant','published',true,4),
(null,'REVA_GOLD','Gold & Jewelry AI Agent','gold','Gold, jewelry and goldsmithing assistant','published',true,5),
(null,'REVA_RESTAURANTS','Restaurants AI Agent','restaurants','Restaurants and cafes assistant','published',true,6)
on conflict (tenant_id,slug) do nothing;

create table if not exists public.ai_agent_voices (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references public.ai_agents(id) on delete cascade,
    language_code text not null references public.languages(code),
    provider text not null,
    voice_id text not null,
    voice_name text,
    settings jsonb not null default '{}'::jsonb,
    is_default boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(agent_id,language_code,provider,voice_id)
);

create table if not exists public.agent_voice_settings (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references public.ai_agents(id) on delete cascade,
    language_code text not null references public.languages(code),
    provider text,
    voice_id text,
    speaking_rate numeric(6,3) default 1.0,
    pitch numeric(8,3) default 0,
    volume numeric(8,3) default 1.0,
    style text,
    emotion text,
    config jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(agent_id,language_code)
);

create table if not exists public.tenant_agents (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    agent_id uuid not null references public.ai_agents(id) on delete cascade,
    is_enabled boolean not null default true,
    custom_name text,
    custom_description text,
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(tenant_id,agent_id)
);

create table if not exists public.agent_features (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references public.ai_agents(id) on delete cascade,
    feature_key text not null,
    feature_name text not null,
    description text,
    is_enabled boolean not null default true,
    config jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(agent_id,feature_key)
);

-- ------------------------------------------------------------
-- 4. CHANNELS / ACCOUNTS / AGENT CHANNEL SETTINGS
-- ------------------------------------------------------------

create table if not exists public.channels (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    type_code text not null references public.channel_types(code),
    name text not null,
    description text,
    is_active boolean not null default true,
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.channel_accounts (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.channels(id) on delete cascade,
    external_account_id text,
    account_name text,
    endpoint text,
    credential_reference text,
    access_token_encrypted text,
    refresh_token_encrypted text,
    secret_reference text,
    webhook_secret_reference text,
    metadata jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.agent_channels (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references public.ai_agents(id) on delete cascade,
    channel_id uuid not null references public.channels(id) on delete cascade,
    is_enabled boolean not null default true,
    can_receive boolean not null default true,
    can_send boolean not null default true,
    config jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(agent_id,channel_id)
);

-- ------------------------------------------------------------
-- 5. SERVICES / PRODUCTS / COURSES / APPLICATIONS
-- ------------------------------------------------------------

create table if not exists public.services (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    language_code text not null default 'ar' references public.languages(code),
    name text not null,
    slug text not null,
    description text,
    price numeric(14,2),
    currency text not null default 'USD',
    status text not null default 'draft'
        check (status in ('draft','published','archived')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_id,slug,language_code)
);

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    product_type text not null references public.product_types(code),
    sku text,
    name text not null,
    slug text not null,
    description text,
    price numeric(14,2),
    currency text not null default 'USD',
    status text not null default 'draft'
        check (status in ('draft','published','archived')),
    reference_id uuid,
    is_digital boolean not null default true,
    delivery_config jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_id,slug)
);

create table if not exists public.courses (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    product_id uuid references public.products(id) on delete set null,
    title text not null,
    slug text not null,
    description text,
    status text not null default 'draft'
        check (status in ('draft','published','archived')),
    language_code text not null default 'ar' references public.languages(code),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_id,slug)
);

create table if not exists public.course_modules (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses(id) on delete cascade,
    title text not null,
    description text,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.course_lessons (
    id uuid primary key default gen_random_uuid(),
    module_id uuid not null references public.course_modules(id) on delete cascade,
    title text not null,
    content text,
    media_url text,
    sort_order integer not null default 0,
    is_published boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    name text not null,
    slug text not null,
    description text,
    url text,
    price numeric(14,2),
    currency text not null default 'USD',
    status text not null default 'draft'
        check (status in ('draft','published','archived')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_id,slug)
);

-- ------------------------------------------------------------
-- 6. PROMPT LIBRARY / PROTECTED CONTENT
-- ------------------------------------------------------------

create table if not exists public.prompts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    language_code text not null default 'ar' references public.languages(code),
    title text not null,
    slug text not null,
    short_description text,
    category text,
    price numeric(14,2),
    currency text not null default 'USD',
    status text not null default 'draft'
        check (status in ('draft','published','archived')),
    is_paid boolean not null default true,
    preview_content text,
    tags text[] not null default '{}',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_id,slug,language_code)
);

create table if not exists public.prompt_content (
    prompt_id uuid primary key references public.prompts(id) on delete cascade,
    protected_content text not null,
    version integer not null default 1,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. ORDERS / ORDER ITEMS / ENTITLEMENTS
-- ------------------------------------------------------------

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete set null,
    customer_auth_user_id uuid,
    customer_email text,
    customer_name text,
    currency text not null default 'USD',
    subtotal numeric(14,2) not null default 0,
    discount numeric(14,2) not null default 0,
    total numeric(14,2) not null default 0,
    payment_provider text,
    payment_reference text,
    status text not null default 'pending'
        check (status in ('pending','paid','failed','cancelled','refunded')),
    paid_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id uuid references public.products(id) on delete set null,
    prompt_id uuid references public.prompts(id) on delete set null,
    service_id uuid references public.services(id) on delete set null,
    course_id uuid references public.courses(id) on delete set null,
    application_id uuid references public.applications(id) on delete set null,
    item_name text not null,
    quantity integer not null default 1 check(quantity > 0),
    unit_price numeric(14,2) not null default 0,
    total_price numeric(14,2) not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.customer_entitlements (
    id uuid primary key default gen_random_uuid(),
    customer_auth_user_id uuid,
    customer_email text,
    tenant_id uuid references public.tenants(id) on delete cascade,
    product_id uuid references public.products(id) on delete cascade,
    prompt_id uuid references public.prompts(id) on delete cascade,
    course_id uuid references public.courses(id) on delete cascade,
    application_id uuid references public.applications(id) on delete cascade,
    order_id uuid references public.orders(id) on delete set null,
    status text not null default 'active'
        check(status in ('active','expired','revoked')),
    starts_at timestamptz not null default now(),
    expires_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. PAGES / SECTIONS / SITE CONTENT
-- ------------------------------------------------------------

create table if not exists public.pages (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    language_code text not null default 'ar' references public.languages(code),
    title text not null,
    slug text not null,
    meta_title text,
    meta_description text,
    status text not null default 'draft'
        check(status in ('draft','published','archived')),
    is_public boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_id,slug,language_code)
);

create table if not exists public.page_sections (
    id uuid primary key default gen_random_uuid(),
    page_id uuid not null references public.pages(id) on delete cascade,
    section_key text not null,
    section_type text not null default 'content',
    title text,
    body text,
    media_url text,
    config jsonb not null default '{}'::jsonb,
    sort_order integer not null default 0,
    status text not null default 'draft'
        check(status in ('draft','published','archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(page_id,section_key)
);

-- ------------------------------------------------------------
-- 9. LEADS / BOOKINGS
-- ------------------------------------------------------------

create table if not exists public.leads (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    source_channel_id uuid references public.channels(id) on delete set null,
    auth_user_id uuid,
    name text,
    email text,
    phone text,
    whatsapp text,
    preferred_language text references public.languages(code),
    interested_item_id uuid,
    interested_item_type text,
    status text not null default 'new'
        check(status in ('new','contacted','qualified','converted','lost')),
    consent_marketing boolean not null default false,
    consent_at timestamptz,
    notes text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    lead_id uuid references public.leads(id) on delete set null,
    service_id uuid references public.services(id) on delete set null,
    customer_name text,
    customer_email text,
    customer_phone text,
    preferred_language text references public.languages(code),
    starts_at timestamptz,
    ends_at timestamptz,
    status text not null default 'pending'
        check(status in ('pending','confirmed','completed','cancelled','no_show')),
    notes text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 10. CONVERSATIONS / MESSAGES
-- ------------------------------------------------------------

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    channel_id uuid references public.channels(id) on delete set null,
    channel_account_id uuid references public.channel_accounts(id) on delete set null,
    external_conversation_id text,
    customer_auth_user_id uuid,
    customer_external_id text,
    customer_name text,
    customer_email text,
    customer_phone text,
    preferred_language text references public.languages(code),
    current_language text references public.languages(code),
    interaction_mode text not null default 'text'
        check(interaction_mode in ('text','voice','mixed')),
    voice_enabled boolean not null default true,
    voice_provider text,
    voice_id text,
    service_window_expires_at timestamptz,
    last_message_at timestamptz,
    status text not null default 'open'
        check(status in ('open','closed','human_handoff','blocked')),
    context jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    message_type text not null default 'text' references public.message_types(code),
    direction text not null default 'inbound'
        check(direction in ('inbound','outbound','internal')),
    language_code text references public.languages(code),
    content text,
    audio_url text,
    audio_duration_seconds numeric(10,3),
    media_url text,
    external_message_id text,
    delivery_status text default 'received'
        check(delivery_status in ('received','queued','processing','sent','delivered','read','failed')),
    interactive_type text,
    interactive_data jsonb not null default '{}'::jsonb,
    received_at timestamptz,
    sent_at timestamptz,
    processing_started_at timestamptz,
    processing_completed_at timestamptz,
    response_latency_ms integer,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists uq_channel_external_message
on public.conversation_messages(external_message_id)
where external_message_id is not null;

create table if not exists public.channel_events (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid references public.channels(id) on delete cascade,
    channel_account_id uuid references public.channel_accounts(id) on delete cascade,
    external_event_id text not null,
    event_type text,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'received'
        check(status in ('received','queued','processed','failed','ignored')),
    received_at timestamptz not null default now(),
    processed_at timestamptz,
    error_message text,
    unique(channel_account_id,external_event_id)
);

-- ------------------------------------------------------------
-- 11. GENERIC AGENT TASKS
-- ------------------------------------------------------------

create table if not exists public.agent_tasks (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    task_type_code text not null references public.agent_task_types(code),
    requested_by_auth_user_id uuid,
    conversation_id uuid references public.conversations(id) on delete set null,
    lead_id uuid references public.leads(id) on delete set null,
    status_code text not null default 'queued' references public.task_statuses(code),
    priority integer not null default 100,
    input_data jsonb not null default '{}'::jsonb,
    output_data jsonb not null default '{}'::jsonb,
    error_message text,
    external_job_id text,
    queued_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_agent_tasks_queue
on public.agent_tasks(status_code,priority,queued_at);

-- ------------------------------------------------------------
-- 12. ADVERTISING
-- ------------------------------------------------------------

create table if not exists public.ad_campaigns (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    task_id uuid references public.agent_tasks(id) on delete set null,
    name text not null,
    objective text,
    platform text,
    audience jsonb not null default '{}'::jsonb,
    budget numeric(14,2),
    currency text not null default 'USD',
    start_at timestamptz,
    end_at timestamptz,
    status text not null default 'draft'
        check(status in ('draft','planned','active','paused','completed','cancelled')),
    strategy jsonb not null default '{}'::jsonb,
    results jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ad_creatives (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
    language_code text not null default 'ar' references public.languages(code),
    creative_type text not null default 'copy',
    headline text,
    body text,
    call_to_action text,
    media_url text,
    target_url text,
    metadata jsonb not null default '{}'::jsonb,
    status text not null default 'draft'
        check(status in ('draft','approved','published','archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 13. PODCASTS
-- ------------------------------------------------------------

create table if not exists public.podcasts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    task_id uuid references public.agent_tasks(id) on delete set null,
    title text not null,
    description text,
    language_code text not null default 'ar' references public.languages(code),
    host_voice_id text,
    cohost_voice_id text,
    cover_image_url text,
    status text not null default 'draft'
        check(status in ('draft','processing','published','archived')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.podcast_episodes (
    id uuid primary key default gen_random_uuid(),
    podcast_id uuid not null references public.podcasts(id) on delete cascade,
    episode_number integer,
    title text not null,
    description text,
    script text,
    audio_url text,
    duration_seconds numeric(12,3),
    status text not null default 'draft'
        check(status in ('draft','processing','published','archived')),
    published_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 14. YOUTUBE / AFFILIATE
-- ------------------------------------------------------------

create table if not exists public.youtube_content (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete set null,
    title text not null,
    description text,
    video_url text,
    thumbnail_url text,
    language_code text not null default 'ar' references public.languages(code),
    status text not null default 'draft'
        check(status in ('draft','published','archived')),
    tags text[] not null default '{}',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_links (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    youtube_content_id uuid references public.youtube_content(id) on delete cascade,
    title text not null,
    provider text,
    url text not null,
    disclosure text,
    is_active boolean not null default true,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 15. KNOWLEDGE / AI TOOLS
-- ------------------------------------------------------------

create table if not exists public.ai_knowledge (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete cascade,
    agent_id uuid references public.ai_agents(id) on delete cascade,
    language_code text references public.languages(code),
    title text not null,
    source_type text not null default 'manual',
    source_url text,
    content text,
    embedding vector(1536),
    metadata jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ai_tools (
    id uuid primary key default gen_random_uuid(),
    tool_key text unique not null,
    name text not null,
    description text,
    input_schema jsonb not null default '{}'::jsonb,
    output_schema jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.ai_agent_tools (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references public.ai_agents(id) on delete cascade,
    tool_id uuid not null references public.ai_tools(id) on delete cascade,
    permissions jsonb not null default '{}'::jsonb,
    is_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    unique(agent_id,tool_id)
);

insert into public.ai_tools(tool_key,name,description) values
('get_agent_info','Get Agent Info','Return public agent information'),
('search_prompts','Search Prompts','Search public prompt metadata'),
('get_prompt_details','Get Prompt Details','Return prompt metadata without protected content'),
('get_service_info','Get Service Info','Return service details'),
('create_lead','Create Lead','Create a consented lead'),
('create_booking','Create Booking','Create a booking request'),
('create_order','Create Order','Create an order'),
('recommend_youtube','Recommend YouTube','Recommend relevant YouTube content'),
('get_page_link','Get Page Link','Return a public page link'),
('get_application_info','Get Application Info','Return application details'),
('voice_response','Voice Response','Generate TTS response'),
('voice_input','Voice Input','Transcribe speech'),
('create_agent_task','Create Agent Task','Queue an asynchronous agent task'),
('generate_ad_campaign','Generate Ad Campaign','Create an advertising campaign task'),
('generate_podcast','Generate Podcast','Create a podcast generation task'),
('human_handoff','Human Handoff','Escalate conversation to human')
on conflict(tool_key) do nothing;

-- ------------------------------------------------------------
-- 16. AGENT SETTINGS
-- ------------------------------------------------------------

create table if not exists public.agent_settings (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid not null references public.ai_agents(id) on delete cascade,
    setting_key text not null,
    setting_value jsonb not null default '{}'::jsonb,
    is_public boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(agent_id,setting_key)
);

-- ------------------------------------------------------------
-- 17. AUDIT LOG
-- ------------------------------------------------------------

create table if not exists public.audit_log (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete set null,
    actor_auth_user_id uuid,
    actor_admin_id uuid references public.admins(id) on delete set null,
    action text not null,
    entity_type text,
    entity_id uuid,
    before_data jsonb,
    after_data jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 18. DEFAULT SITE PAGES
-- ------------------------------------------------------------

insert into public.pages(tenant_id,language_code,title,slug,status,is_public,sort_order)
values
(null,'ar','الرئيسية','home','published',true,1),
(null,'en','Home','home','published',true,1),
(null,'fr','Accueil','home','published',true,1),
(null,'ar','وكلاء الذكاء الاصطناعي','ai-agents','published',true,2),
(null,'en','AI Agents','ai-agents','published',true,2),
(null,'fr','Agents IA','ai-agents','published',true,2),
(null,'ar','الإعلانات','advertising','published',true,3),
(null,'en','Advertising','advertising','published',true,3),
(null,'fr','Publicité','advertising','published',true,3),
(null,'ar','مكتبة البرومبت','prompts','published',true,4),
(null,'en','Prompt Library','prompts','published',true,4),
(null,'fr','Bibliothèque de prompts','prompts','published',true,4),
(null,'ar','التطبيقات','applications','published',true,5),
(null,'en','Applications','applications','published',true,5),
(null,'fr','Applications','applications','published',true,5),
(null,'ar','يوتيوب','youtube','published',true,6),
(null,'en','YouTube','youtube','published',true,6),
(null,'fr','YouTube','youtube','published',true,6)
on conflict(tenant_id,slug,language_code) do nothing;

-- ------------------------------------------------------------
-- 19. INDEXES
-- ------------------------------------------------------------

create index if not exists idx_agents_status on public.ai_agents(status,is_public);
create index if not exists idx_agents_tenant on public.ai_agents(tenant_id);
create index if not exists idx_services_tenant_status on public.services(tenant_id,status);
create index if not exists idx_products_tenant_status on public.products(tenant_id,status);
create index if not exists idx_prompts_status_category on public.prompts(status,category);
create index if not exists idx_orders_customer on public.orders(customer_auth_user_id,customer_email);
create index if not exists idx_entitlements_customer on public.customer_entitlements(customer_auth_user_id,customer_email);
create index if not exists idx_pages_public on public.pages(status,is_public);
create index if not exists idx_page_sections_page on public.page_sections(page_id,sort_order);
create index if not exists idx_leads_tenant_status on public.leads(tenant_id,status);
create index if not exists idx_bookings_tenant_time on public.bookings(tenant_id,starts_at);
create index if not exists idx_conversations_external on public.conversations(channel_id,external_conversation_id);
create index if not exists idx_messages_conversation_time on public.conversation_messages(conversation_id,created_at);
create index if not exists idx_messages_processing on public.conversation_messages(delivery_status,created_at);
create index if not exists idx_channel_events_status on public.channel_events(status,received_at);
create index if not exists idx_campaigns_tenant_status on public.ad_campaigns(tenant_id,status);
create index if not exists idx_creatives_campaign on public.ad_creatives(campaign_id,status);
create index if not exists idx_podcasts_tenant on public.podcasts(tenant_id,status);
create index if not exists idx_episodes_podcast on public.podcast_episodes(podcast_id,status);
create index if not exists idx_youtube_tenant on public.youtube_content(tenant_id,status);
create index if not exists idx_knowledge_agent on public.ai_knowledge(agent_id,is_active);
create index if not exists idx_audit_tenant_time on public.audit_log(tenant_id,created_at);

-- ------------------------------------------------------------
-- 20. UPDATED_AT TRIGGER
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

do $$
declare
    t text;
begin
    foreach t in array array[
        'tenants','admins','tenant_members','ai_agents','ai_agent_voices',
        'agent_voice_settings','services','products','courses','course_lessons',
        'applications','prompts','prompt_content','orders','customer_entitlements',
        'pages','page_sections','leads','bookings','conversations','agent_tasks',
        'ad_campaigns','ad_creatives','podcasts','podcast_episodes','youtube_content',
        'affiliate_links','ai_knowledge','ai_tools','agent_settings','channels',
        'channel_accounts','agent_channels'
    ]
    loop
        execute format(
            'drop trigger if exists trg_%I_updated_at on public.%I',
            t,t
        );
        execute format(
            'create trigger trg_%I_updated_at before update on public.%I
             for each row execute function public.set_updated_at()',
            t,t
        );
    end loop;
end $$;

-- ------------------------------------------------------------
-- 21. PUBLIC-SAFE FUNCTIONS
-- ------------------------------------------------------------

create or replace function public.get_public_prompt_details(p_prompt_id uuid)
returns table (
    id uuid,
    title text,
    short_description text,
    category text,
    price numeric,
    currency text,
    language_code text,
    preview_content text
)
language sql
security definer
set search_path = public
as $$
    select p.id,p.title,p.short_description,p.category,p.price,p.currency,
           p.language_code,p.preview_content
    from public.prompts p
    where p.id = p_prompt_id
      and p.status = 'published';
$$;

-- Protected prompt content must be returned only after a verified purchase.
-- This function deliberately requires a customer identifier and checks
-- customer_entitlements before exposing prompt_content.
create or replace function public.get_prompt_content_if_entitled(
    p_prompt_id uuid,
    p_customer_auth_user_id uuid default null,
    p_customer_email text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_content text;
begin
    if p_customer_auth_user_id is null and p_customer_email is null then
        raise exception 'Customer identity is required';
    end if;

    if not exists (
        select 1
        from public.customer_entitlements e
        where e.prompt_id = p_prompt_id
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
          and (
              (p_customer_auth_user_id is not null and e.customer_auth_user_id = p_customer_auth_user_id)
              or
              (p_customer_email is not null and lower(e.customer_email) = lower(p_customer_email))
          )
    ) then
        raise exception 'Purchase entitlement not found';
    end if;

    select pc.protected_content
      into v_content
      from public.prompt_content pc
     where pc.prompt_id = p_prompt_id;

    if v_content is null then
        raise exception 'Protected prompt content not found';
    end if;

    return v_content;
end;
$$;

-- ------------------------------------------------------------
-- 22. RLS FOUNDATION
-- ------------------------------------------------------------

do $$
declare
    t text;
begin
    foreach t in array array[
        'languages','channel_types','product_types','agent_task_types',
        'message_types','task_statuses','tenants','admins','tenant_members',
        'ai_agents','ai_agent_voices','agent_voice_settings','tenant_agents',
        'agent_features','channels','channel_accounts','agent_channels',
        'services','products','courses','course_modules','course_lessons',
        'applications','prompts','prompt_content','orders','order_items',
        'customer_entitlements','pages','page_sections','leads','bookings',
        'conversations','conversation_messages','channel_events','agent_tasks',
        'ad_campaigns','ad_creatives','podcasts','podcast_episodes',
        'youtube_content','affiliate_links','ai_knowledge','ai_tools',
        'ai_agent_tools','agent_settings','audit_log'
    ]
    loop
        execute format('alter table public.%I enable row level security',t);
    end loop;
end $$;

-- Public read policies only for intentionally public data.
drop policy if exists public_languages_read on public.languages;
create policy public_languages_read on public.languages
for select using (is_active = true);

drop policy if exists public_channel_types_read on public.channel_types;
create policy public_channel_types_read on public.channel_types
for select using (is_active = true);

drop policy if exists public_product_types_read on public.product_types;
create policy public_product_types_read on public.product_types
for select using (true);

drop policy if exists public_task_types_read on public.agent_task_types;
create policy public_task_types_read on public.agent_task_types
for select using (is_active = true);

drop policy if exists public_message_types_read on public.message_types;
create policy public_message_types_read on public.message_types
for select using (true);

drop policy if exists public_task_statuses_read on public.task_statuses;
create policy public_task_statuses_read on public.task_statuses
for select using (true);

drop policy if exists public_agents_read on public.ai_agents;
create policy public_agents_read on public.ai_agents
for select using (status='published' and is_public=true);

drop policy if exists public_agent_voices_read on public.ai_agent_voices;
create policy public_agent_voices_read on public.ai_agent_voices
for select using (is_active=true);

drop policy if exists public_features_read on public.agent_features;
create policy public_features_read on public.agent_features
for select using (is_enabled=true);

drop policy if exists public_services_read on public.services;
create policy public_services_read on public.services
for select using (status='published');

drop policy if exists public_applications_read on public.applications;
create policy public_applications_read on public.applications
for select using (status='published');

drop policy if exists public_pages_read on public.pages;
create policy public_pages_read on public.pages
for select using (status='published' and is_public=true);

drop policy if exists public_page_sections_read on public.page_sections;
create policy public_page_sections_read on public.page_sections
for select using (
    status='published'
    and exists (
        select 1 from public.pages p
        where p.id=page_sections.page_id
          and p.status='published'
          and p.is_public=true
    )
);

drop policy if exists public_products_read on public.products;
create policy public_products_read on public.products
for select using (status='published');

drop policy if exists public_courses_read on public.courses;
create policy public_courses_read on public.courses
for select using (status='published');

drop policy if exists public_prompts_read on public.prompts;
create policy public_prompts_read on public.prompts
for select using (status='published');

drop policy if exists public_youtube_read on public.youtube_content;
create policy public_youtube_read on public.youtube_content
for select using (status='published');

drop policy if exists public_affiliate_read on public.affiliate_links;
create policy public_affiliate_read on public.affiliate_links
for select using (is_active=true);

-- NO public SELECT policy is created for prompt_content, orders,
-- entitlements, conversations, messages, channel accounts, tokens,
-- private knowledge, tasks, campaigns, admins or audit logs.

-- ------------------------------------------------------------
-- 23. SEED DEFAULT AGENT TOOLS
-- ------------------------------------------------------------

insert into public.ai_agent_tools(agent_id,tool_id)
select a.id,t.id
from public.ai_agents a
cross join public.ai_tools t
where a.tenant_id is null
  and t.tool_key in (
    'get_agent_info','search_prompts','get_prompt_details',
    'get_service_info','create_lead','create_booking','create_order',
    'recommend_youtube','get_page_link','get_application_info',
    'voice_response','voice_input','create_agent_task',
    'generate_ad_campaign','generate_podcast','human_handoff'
  )
on conflict(agent_id,tool_id) do nothing;

-- ------------------------------------------------------------
-- 24. INITIAL VOICE PLACEHOLDERS
-- ------------------------------------------------------------

insert into public.ai_agent_voices(agent_id,language_code,provider,voice_id,voice_name,is_default)
select a.id,l.code,'tts_provider','CHANGE_ME',l.native_name,true
from public.ai_agents a
cross join public.languages l
where a.tenant_id is null
  and not exists (
      select 1 from public.ai_agent_voices v
      where v.agent_id=a.id and v.language_code=l.code
  );

-- ------------------------------------------------------------
-- 25. VERIFICATION
-- ------------------------------------------------------------

do $$
declare
    agent_count integer;
    lang_count integer;
begin
    select count(*) into agent_count
    from public.ai_agents
    where tenant_id is null;

    select count(*) into lang_count
    from public.languages
    where code in ('ar','en','fr');

    if agent_count < 6 then
        raise exception 'Verification failed: fewer than 6 base agents exist';
    end if;

    if lang_count < 3 then
        raise exception 'Verification failed: Arabic/English/French languages missing';
    end if;

    raise notice 'Reva Nexus V11 SQL V2 Master verification passed: % agents, % languages',
        agent_count,lang_count;
end $$;

-- ============================================================
-- END OF REVA NEXUS V11 SQL V2 MASTER
-- ============================================================
