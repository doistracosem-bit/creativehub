create table public.tiktok_reports (
    id uuid primary key,
    client_id uuid not null references public.clients(id) on delete cascade,
    input jsonb not null check (jsonb_typeof(input) = 'object'),
    metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
    advice jsonb check (advice is null or jsonb_typeof(advice) = 'object'),
    created_at timestamptz not null default now()
);

create index tiktok_reports_client_history on public.tiktok_reports (client_id, created_at desc, id desc);
alter table public.tiktok_reports enable row level security;
revoke all on table public.tiktok_reports from public, anon, authenticated;
grant select, delete on table public.tiktok_reports to authenticated;
grant select, insert, update on table public.tiktok_reports to service_role;

create policy tiktok_reports_team_read on public.tiktok_reports for select to authenticated
    using ((select privado.is_member()) and exists (
        select 1 from public.clients where clients.id = tiktok_reports.client_id
    ));
create policy tiktok_reports_team_delete on public.tiktok_reports for delete to authenticated
    using ((select privado.is_member()) and exists (
        select 1 from public.clients where clients.id = tiktok_reports.client_id
    ));
