-- The project confirms password signups automatically. The Central needs proof
-- of mailbox ownership before an email can grant access to a company.
create function portal_private.google_session() returns boolean
language sql stable security definer set search_path = '' as $$
    select auth.uid() is not null
      and coalesce((auth.jwt()->'amr') @> '[{"method":"oauth"}]'::jsonb,false)
      and exists(select 1 from auth.identities i where i.user_id=auth.uid() and i.provider='google'
        and lower(i.identity_data->>'email')=portal_private.email() and i.identity_data->>'email_verified'='true');
$$;
revoke all on function portal_private.google_session() from public,anon,authenticated,service_role;
grant execute on function portal_private.google_session() to authenticated;

create or replace function portal_private.is_team(admin_only boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
    select portal_private.google_session() and exists(select 1 from public.team_members t where t.email=portal_private.email() and (not admin_only or t.role='admin'));
$$;
create or replace function portal_private.has_client(target uuid, approval boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
    select portal_private.google_session() and exists(select 1 from public.portal_access a where a.client_id=target and a.email=portal_private.email() and (not approval or a.role='approve'));
$$;
create or replace function portal_private.can_subscribe() returns boolean
language sql stable security definer set search_path = '' as $$
    select portal_private.google_session() and (portal_private.is_team() or exists(select 1 from public.portal_access where email=portal_private.email()));
$$;
create or replace function portal_private.workspace() returns jsonb
language sql stable security definer set search_path = '' as $$
    select coalesce(jsonb_agg(jsonb_build_object('client_id',c.id,'name',c.name,'role',a.role) order by c.name),'[]'::jsonb)
    from public.portal_access a join public.clients c on c.id=a.client_id
    where a.email=portal_private.email() and portal_private.google_session();
$$;
create or replace function portal_private.settings() returns jsonb
language sql stable security definer set search_path = '' as $$
    select jsonb_build_object('google_verified',portal_private.google_session()) ||
      case when portal_private.is_team() then jsonb_build_object(
      'whatsapp_active', coalesce((select whatsapp_active and checked_at>now()-interval '15 minutes' from portal_private.worker_state),false),
      'phone',(select phone from portal_private.team_phones where email=portal_private.email()))
      else '{}'::jsonb end;
$$;
alter policy portal_access_read on public.portal_access using (
 (select portal_private.is_team()) or (email=(select portal_private.email()) and (select portal_private.google_session()))
);
alter policy portal_devices_own on public.portal_devices using (
  email=(select portal_private.email()) and (select portal_private.can_subscribe())
);
alter policy portal_art_read on storage.objects using (
  bucket_id='portal-art' and
  (exists(select 1 from public.portal_assets a where a.path=name)
    or ((select portal_private.is_team()) and owner_id=(select auth.uid())::text))
);

-- Reuse the production project's existing URL, secret and VAPID configuration.
select cron.schedule('avisos-central-clientes','*/2 * * * *',$portal_job$
  select net.http_post(
    url:=rtrim((select decrypted_secret from vault.decrypted_secrets where name='project_url'),'/')||'/functions/v1/portal-avisos',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='cron_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=55000
  );
$portal_job$);
