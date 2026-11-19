create table public.traffic_campaigns (
    id uuid primary key,
    client_id uuid not null references public.clients(id) on delete cascade,
    plan jsonb not null check (jsonb_typeof(plan) = 'object'),
    created_at timestamptz not null default now(),
    unique (client_id, id)
);

create table public.traffic_reports (
    id uuid primary key,
    client_id uuid not null,
    campaign_id uuid not null,
    previous_id uuid,
    snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
    diagnosis jsonb not null check (jsonb_typeof(diagnosis) = 'object'),
    advice jsonb check (jsonb_typeof(advice) = 'object'),
    created_at timestamptz not null default now(),
    unique (client_id, campaign_id, id),
    check (previous_id is distinct from id),
    foreign key (client_id, campaign_id)
        references public.traffic_campaigns(client_id, id) on delete cascade,
    foreign key (client_id, campaign_id, previous_id)
        references public.traffic_reports(client_id, campaign_id, id) deferrable initially deferred
);

create index traffic_campaigns_client_created on public.traffic_campaigns(client_id, created_at desc, id);
create index traffic_reports_client_created on public.traffic_reports(client_id, created_at desc, id);
create index traffic_reports_previous on public.traffic_reports(client_id, campaign_id, previous_id);

alter table public.traffic_campaigns enable row level security;
alter table public.traffic_reports enable row level security;

revoke all on public.traffic_campaigns, public.traffic_reports from public, anon, authenticated, service_role;
grant select on public.traffic_campaigns, public.traffic_reports to authenticated;
grant select, insert on public.traffic_campaigns, public.traffic_reports to service_role;
grant update (advice) on public.traffic_reports to service_role;

-- Reuse the Creative Hub client policy. Clients visible to the team remain shared
-- within that team. Campaign and revision foreign keys cannot cross client IDs.
create policy traffic_campaigns_read on public.traffic_campaigns for select to authenticated
    using (exists (select 1 from public.clients c where c.id = traffic_campaigns.client_id));
create policy traffic_reports_read on public.traffic_reports for select to authenticated
    using (exists (select 1 from public.clients c where c.id = traffic_reports.client_id));
