create schema portal_private;
revoke all on schema portal_private from public;
grant usage on schema portal_private to authenticated, service_role;

create table public.portal_access (
    client_id uuid not null references public.clients(id) on delete cascade,
    email text not null check (email = lower(email)),
    name text not null,
    role text not null check (role in ('approve','view')),
    phone text check (phone ~ '^[1-9][0-9]{7,14}$'),
    whatsapp_opt_in boolean not null default false,
    primary key(client_id,email)
);
create index portal_access_email on public.portal_access(email,client_id);

create table public.portal_batches (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    title text not null,
    due_at timestamptz not null,
    reminded_at timestamptz,
    created_at timestamptz not null default now(),
    unique(client_id,id)
);
create index portal_due_batches on public.portal_batches(due_at) where reminded_at is null;

create table public.portal_posts (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    publication_id uuid unique references public.publications(id) on delete set null,
    batch_id uuid,
    title text not null,
    caption text not null default '',
    format text not null,
    scheduled_at timestamptz not null,
    shared_at timestamptz,
    released_at timestamptz,
    published_at timestamptz,
    art_version integer not null default 0,
    caption_version integer not null default 1,
    art_status text not null default 'pending' check (art_status in ('pending','approved','changes')),
    caption_status text not null default 'pending' check (caption_status in ('pending','approved','changes')),
    rejection text,
    revision integer not null default 1,
    created_at timestamptz not null default now(),
    foreign key(client_id,batch_id) references public.portal_batches(client_id,id)
);
create index portal_posts_client on public.portal_posts(client_id,scheduled_at);
create index portal_posts_batch on public.portal_posts(batch_id);

create table public.portal_assets (
    post_id uuid not null references public.portal_posts(id) on delete cascade,
    version integer not null,
    position integer not null,
    path text not null unique,
    mime text not null,
    primary key(post_id,version,position)
);
create table public.portal_history (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.portal_posts(id) on delete cascade,
    actor text not null,
    action text not null,
    part text,
    version integer,
    detail text,
    created_at timestamptz not null default now()
);
create index portal_history_post on public.portal_history(post_id,created_at desc);

create table public.portal_notices (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    client_id uuid not null references public.clients(id) on delete cascade,
    post_id uuid references public.portal_posts(id) on delete cascade,
    batch_id uuid references public.portal_batches(id) on delete cascade,
    kind text not null,
    title text not null,
    body text not null,
    read_at timestamptz,
    created_at timestamptz not null default now()
);
create index portal_notices_recipient on public.portal_notices(email,created_at desc);

create table portal_private.team_phones (
    email text primary key references public.team_members(email) on delete cascade,
    phone text not null check (phone ~ '^[1-9][0-9]{7,14}$')
);
create table public.portal_devices (
    endpoint text primary key,
    p256dh text not null,
    auth text not null,
    email text not null
);
create index portal_devices_email on public.portal_devices(email);
create table portal_private.delivery (
    id uuid primary key default gen_random_uuid(),
    notice_id uuid not null references public.portal_notices(id) on delete cascade,
    event_id uuid not null,
    channel text not null check(channel in ('push','whatsapp')),
    destination text not null,
    state text not null default 'pending' check(state in ('pending','leased','sent','skipped','failed')),
    attempts integer not null default 0,
    available_at timestamptz not null default now(),
    leased_at timestamptz,
    unique(event_id,channel,destination)
);
create index portal_delivery_pending on portal_private.delivery(available_at) where state in ('pending','leased');

create function portal_private.email() returns text
language sql stable set search_path = '' as $$
    select lower(coalesce(auth.jwt()->>'email',''));
$$;
create function portal_private.is_team(admin_only boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists(select 1 from public.team_members t where t.email=portal_private.email() and (not admin_only or t.role='admin'));
$$;
create function portal_private.has_client(target uuid, approval boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists(select 1 from public.portal_access a where a.client_id=target and a.email=portal_private.email() and (not approval or a.role='approve'));
$$;
create function portal_private.can_subscribe() returns boolean
language sql stable security definer set search_path = '' as $$
    select portal_private.is_team() or exists(select 1 from public.portal_access where email=portal_private.email());
$$;

alter table public.portal_access enable row level security;
alter table public.portal_batches enable row level security;
alter table public.portal_posts enable row level security;
alter table public.portal_assets enable row level security;
alter table public.portal_history enable row level security;
alter table public.portal_notices enable row level security;
alter table public.portal_devices enable row level security;
revoke all on public.portal_access,public.portal_batches,public.portal_posts,public.portal_assets,public.portal_history,
    public.portal_notices,public.portal_devices from public,anon,authenticated,service_role;
grant select on public.portal_access,public.portal_batches,public.portal_posts,public.portal_assets,public.portal_history,public.portal_notices,public.portal_devices to authenticated;
grant insert,update,delete on public.portal_devices to authenticated;
grant select,delete on public.portal_devices to service_role;

create policy portal_access_read on public.portal_access for select to authenticated
using ((select portal_private.is_team()) or email=(select portal_private.email()));
create policy portal_batches_read on public.portal_batches for select to authenticated
using ((select portal_private.is_team()) or portal_private.has_client(client_id));
create policy portal_posts_read on public.portal_posts for select to authenticated
using ((select portal_private.is_team()) or (shared_at is not null and portal_private.has_client(client_id)));
create policy portal_assets_read on public.portal_assets for select to authenticated
using (exists(select 1 from public.portal_posts p where p.id=post_id));
create policy portal_history_read on public.portal_history for select to authenticated
using (exists(select 1 from public.portal_posts p where p.id=post_id));
create policy portal_notices_read on public.portal_notices for select to authenticated
using (email=(select portal_private.email()) and ((select portal_private.is_team()) or portal_private.has_client(client_id)));
create policy portal_devices_own on public.portal_devices for all to authenticated
using (email=(select portal_private.email()) and email <> '')
with check (email=(select portal_private.email()) and (select portal_private.can_subscribe())
    and endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' and length(endpoint)<=2048
    and p256dh ~ '^[A-Za-z0-9_-]{80,100}$' and auth ~ '^[A-Za-z0-9_-]{16,30}$');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('portal-art','portal-art',false,50000000,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']);
create policy portal_art_read on storage.objects for select to authenticated
using (bucket_id='portal-art' and exists(select 1 from public.portal_assets a where a.path=name));
create policy portal_art_upload on storage.objects for insert to authenticated
with check (bucket_id='portal-art' and (select portal_private.is_team())
    and exists(select 1 from public.portal_posts p where p.id::text=(storage.foldername(name))[1]));
create policy portal_art_orphan on storage.objects for delete to authenticated
using (bucket_id='portal-art' and (select portal_private.is_team()) and owner_id=(select auth.uid())::text
    and not exists(select 1 from public.portal_assets a where a.path=name));

create function portal_private.actor(client uuid) returns text
language sql stable security definer set search_path = '' as $$
    select coalesce(
      (select name from public.team_members where email=portal_private.email()),
      (select name from public.portal_access where client_id=client and email=portal_private.email()),'Dois Traços');
$$;
create function portal_private.note(target public.portal_posts, kind text, section text default null, message text default null) returns void
language sql security definer set search_path = '' as $$
    insert into public.portal_history(post_id,actor,action,part,version,detail)
    values(target.id,portal_private.actor(target.client_id),kind,section,
        case section when 'art' then target.art_version when 'caption' then target.caption_version end,message);
$$;

-- Queue one message per recipient and channel for each event.
create function portal_private.event(client uuid, post uuid, batch uuid, kind text, title text, body text, audience text, responsible text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare event_key uuid := gen_random_uuid(); recipient record; notice uuid;
begin
    for recipient in
        select a.email, case when a.whatsapp_opt_in then a.phone end as phone, a.role from public.portal_access a
            where a.client_id=client and (audience='client_all' or (audience='client_approvers' and a.role='approve'))
        union all
        select t.email,p.phone,'team' from public.team_members t left join portal_private.team_phones p on p.email=t.email
            where audience='team' and (responsible is null or t.email=lower(responsible))
    loop
        insert into public.portal_notices(email,client_id,post_id,batch_id,kind,title,body)
        values(recipient.email,client,post,batch,kind,title,body) returning id into notice;
        insert into portal_private.delivery(notice_id,event_id,channel,destination)
        select notice,event_key,'push',d.endpoint from public.portal_devices d where d.email=recipient.email
        on conflict do nothing;
        if kind in ('batch','art','caption','overdue','changes','rejected') and recipient.phone is not null then
            insert into portal_private.delivery(notice_id,event_id,channel,destination)
            values(notice,event_key,'whatsapp',recipient.phone) on conflict do nothing;
        end if;
    end loop;
end;
$$;

-- Restrict the team app's older editor to the approved version after sharing.
create function portal_private.protect_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
declare review public.portal_posts;
begin
    select * into review from public.portal_posts where publication_id=new.id and shared_at is not null;
    if not found then return new; end if;
    if new.client_name is distinct from old.client_name then
        raise exception 'Este post já foi compartilhado. A empresa só pode ser mantida.';
    end if;
    if new.status is distinct from old.status and new.status in ('APROVADO','AGENDADO','POSTADO') and review.released_at is null then
        raise exception 'Conclua a revisão final na Central de Clientes antes de liberar o post.';
    end if;
    if new.status is distinct from old.status and new.status='POSTADO' and review.published_at is null then
        raise exception 'Registre a publicação na Central de Clientes.';
    end if;
    if (new.copy_text is distinct from old.copy_text and new.copy_text is distinct from review.caption)
       or new.headline is distinct from old.headline or new.format is distinct from old.format then
        raise exception 'Edite o material compartilhado na Central de Clientes.';
    end if;
    if review.released_at is null then new.reminder_sent:=true; new.due_sent:=true; end if;
    return new;
end;
$$;
create trigger zz_portal_protect_publication before update on public.publications
for each row execute function portal_private.protect_publication();

create function portal_private.sync_date() returns trigger
language plpgsql security definer set search_path = '' as $$
declare review public.portal_posts; detail text;
begin
    update public.portal_posts set scheduled_at=new.scheduled_for,revision=revision+1
        where publication_id=new.id and published_at is null and scheduled_at is distinct from new.scheduled_for
        returning * into review;
    if found and review.shared_at is not null then
        detail:=review.title||' · '||to_char(old.scheduled_for at time zone 'America/Sao_Paulo','DD/MM')||' → '||
            to_char(new.scheduled_for at time zone 'America/Sao_Paulo','DD/MM');
        perform portal_private.note(review,'Data prevista alterada',null,detail);
        perform portal_private.event(review.client_id,review.id,null,'date','Data de publicação alterada',detail,'client_all');
    end if;
    return new;
end;
$$;
create trigger portal_sync_date after update of scheduled_for on public.publications
for each row when (old.scheduled_for is distinct from new.scheduled_for) execute function portal_private.sync_date();

create function portal_private.store_art(target public.portal_posts, paths jsonb, version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare selected record;
begin
    if jsonb_typeof(paths) is distinct from 'array' then raise exception 'Anexe uma arte ou vídeo.'; end if;
    if jsonb_array_length(paths) not between 1 and 10 then raise exception 'Anexe de 1 a 10 arquivos.'; end if;
    for selected in
        select v.ordinality, o.name, o.metadata->>'mimetype' as mime
        from jsonb_array_elements_text(paths) with ordinality v(path,ordinality)
        join storage.objects o on o.bucket_id='portal-art' and o.name=v.path
        where split_part(o.name,'/',1)=target.id::text and o.metadata->>'mimetype' in
          ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm')
    loop
        insert into public.portal_assets(post_id,version,position,path,mime)
        values(target.id,version,selected.ordinality,selected.name,selected.mime);
    end loop;
    if (select count(*) from public.portal_assets where post_id=target.id and portal_assets.version=store_art.version) <> jsonb_array_length(paths)
    then raise exception 'Confira os arquivos anexados e tente de novo.'; end if;
end;
$$;

create function portal_private.workspace() returns jsonb
language sql stable security definer set search_path = '' as $$
    select coalesce(jsonb_agg(jsonb_build_object('client_id',c.id,'name',c.name,'role',a.role) order by c.name),'[]'::jsonb)
    from public.portal_access a join public.clients c on c.id=a.client_id where a.email=portal_private.email();
$$;
create function public.portal_workspace() returns jsonb
language sql stable security invoker set search_path = '' as $$
    select portal_private.workspace();
$$;

create function portal_private.action(op text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    team boolean:=portal_private.is_team(); client uuid; target_id uuid; ids uuid[]; current_batch uuid;
    p public.portal_posts; source public.publications; input_text text; input_email text; input_phone text;
    section text; responsible text; due timestamptz; stamp timestamptz; total integer;
begin
    if auth.uid() is null or portal_private.email()='' then raise exception 'Entre no Creative Hub para continuar.'; end if;
    client:=nullif(payload->>'client_id','')::uuid;
    target_id:=nullif(payload->>'post_id','')::uuid;
    input_text:=btrim(coalesce(payload->>'text',''));
    if length(input_text)>10000 then raise exception 'O texto ultrapassa 10.000 caracteres.'; end if;
    if op='read' then
        update public.portal_notices set read_at=coalesce(read_at,now())
        where id=(payload->>'notice_id')::uuid and email=portal_private.email()
            and (team or portal_private.has_client(client_id));
        return '{}'::jsonb;
    end if;
    if op in ('access','revoke','team_phone','import','batch','share_history','resend','suggest','minor','release','date','publish')
       and not team then raise exception 'Apenas a Dois Traços pode fazer isso.'; end if;
    if op='team_phone' then
        input_phone:=regexp_replace(coalesce(payload->>'phone',''),'[^0-9]','','g');
        if input_phone='' then delete from portal_private.team_phones where email=portal_private.email();
        elsif input_phone ~ '^[1-9][0-9]{7,14}$' then
            insert into portal_private.team_phones(email,phone) values(portal_private.email(),input_phone)
            on conflict(email) do update set phone=excluded.phone;
        else raise exception 'Informe o WhatsApp com DDI e DDD.'; end if;
        return '{}'::jsonb;
    end if;
    if op in ('access','revoke') then
        if not portal_private.is_team(true) then raise exception 'Apenas um administrador pode gerenciar os acessos.'; end if;
        input_email:=lower(btrim(coalesce(payload->>'email','')));
        if op='revoke' then
            delete from public.portal_access where client_id=client and email=input_email;
        else
            input_phone:=nullif(regexp_replace(coalesce(payload->>'phone',''),'[^0-9]','','g'),'');
            if input_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(input_email)>254
               or input_text='' or length(input_text)>120 or coalesce(payload->>'role','') not in ('approve','view')
               or (payload->>'role'='approve' and (input_phone is null or input_phone !~ '^[1-9][0-9]{7,14}$'))
            then raise exception 'Confira nome, e-mail, permissão e WhatsApp do aprovador com DDI e DDD.'; end if;
            insert into public.portal_access(client_id,email,name,role,phone,whatsapp_opt_in)
            values(client,input_email,input_text,payload->>'role',case when payload->>'role'='approve' then input_phone end,
                payload->>'role'='approve' and coalesce(payload->>'opt_in','')='true')
            on conflict(client_id,email) do update set name=excluded.name,role=excluded.role,phone=excluded.phone,whatsapp_opt_in=excluded.whatsapp_opt_in;
        end if;
        return '{}'::jsonb;
    end if;
    if op='import' then
        select q.* into source from public.publications q join public.clients c on c.name=q.client_name
        where q.id=(payload->>'publication_id')::uuid and c.id=client;
        if not found then raise exception 'Selecione um post da empresa escolhida.'; end if;
        insert into public.portal_posts(client_id,publication_id,title,caption,format,scheduled_at,published_at)
        values(client,source.id,source.headline,coalesce(source.copy_text,''),source.format,source.scheduled_for,
            case when source.status='POSTADO' then source.scheduled_for end)
        on conflict(publication_id) do nothing returning * into p;
        if p.id is null then select * into p from public.portal_posts where publication_id=source.id and client_id=client; end if;
        if p.id is null then raise exception 'O post já está vinculado a outra empresa.'; end if;
        return jsonb_build_object('id',p.id);
    end if;
    if op='batch' then
        if jsonb_typeof(payload->'posts') is distinct from 'array' then raise exception 'Selecione posts para enviar.'; end if;
        select array_agg((value->>'id')::uuid) into ids from jsonb_array_elements(payload->'posts');
        total:=coalesce(cardinality(ids),0);
        due:=((payload->>'due')::date + time '23:59:59') at time zone 'America/Sao_Paulo';
        if total not between 1 and 30 or input_text='' or length(input_text)>120 or due is null or due<=now()
        then raise exception 'Informe o nome, um prazo válido e ao menos um post.'; end if;
        perform 1 from public.portal_posts where id=any(ids) order by id for update;
        if (select count(*) from public.portal_posts where id=any(ids) and client_id=client and shared_at is null and published_at is null and art_version>0)<>total
        then raise exception 'Confira se todos os posts pertencem ao cliente e têm arte anexada.'; end if;
        if exists(select 1 from public.portal_posts r join public.clients c on c.id=r.client_id
            left join public.publications q on q.id=r.publication_id where r.id=any(ids)
            and (q.client_name is distinct from c.name or q.status='POSTADO')) then
            raise exception 'Confira os posts no calendário da empresa antes de enviar.';
        end if;
        if exists(select 1 from jsonb_array_elements(payload->'posts') item join public.portal_posts r on r.id=(item->>'id')::uuid
            where r.revision is distinct from (item->>'revision')::int) then raise exception 'Um dos posts mudou. Atualize e revise o envio.'; end if;
        insert into public.portal_batches(client_id,title,due_at) values(client,input_text,due) returning id into current_batch;
        for p in update public.portal_posts set shared_at=now(),batch_id=current_batch,revision=revision+1
            where id=any(ids) returning * loop
            update public.publications set status='CRIANDO',reminder_sent=true,due_sent=true where id=p.publication_id;
            perform portal_private.note(p,'Enviado para aprovação',null,input_text);
        end loop;
        perform portal_private.event(client,null,current_batch,'batch','Posts para aprovação',
            total||' '||(case when total=1 then 'post' else 'posts' end)||' · prazo '||to_char(due at time zone 'America/Sao_Paulo','DD/MM'),
            'client_approvers');
        return jsonb_build_object('batch_id',current_batch);
    end if;
    select * into p from public.portal_posts where id=target_id and client_id=client for update;
    if not found or (not team and (p.shared_at is null or not portal_private.has_client(p.client_id,true))) then
        raise exception 'Post indisponível para esta conta.';
    end if;
    if p.revision is distinct from (payload->>'revision')::int then raise exception 'O post foi atualizado. Abra a versão mais recente.'; end if;
    if p.published_at is not null and op not in ('share_history','resend') then raise exception 'Este post já foi publicado.'; end if;
    if p.published_at is not null and p.shared_at is not null then raise exception 'Esta publicação já está no histórico.'; end if;
    if not team and (p.rejection is not null or op not in ('approve','changes','reject','edit_caption')) then
        raise exception 'Esta ação não está disponível para o post.';
    end if;
    section:=payload->>'part';
    if op in ('approve','changes') and coalesce(section,'') not in ('art','caption') then raise exception 'Indique a parte do post.'; end if;
    if op in ('changes','reject','edit_caption','suggest','minor') and input_text='' then raise exception 'Preencha o campo de texto.'; end if;
    select q.responsible_email into responsible from public.publications q where q.id=p.publication_id
      and exists(select 1 from public.team_members t where t.email=lower(q.responsible_email));

    case op
    when 'approve' then
        if team then raise exception 'A aprovação é feita por um responsável do cliente.'; end if;
        if (section='art' and p.art_status<>'pending') or (section='caption' and p.caption_status<>'pending') then
            raise exception 'Essa parte não está aguardando aprovação.';
        end if;
        update public.portal_posts set art_status=case when section='art' then 'approved' else art_status end,
            caption_status=case when section='caption' then 'approved' else caption_status end, revision=revision+1 where id=p.id returning * into p;
        perform portal_private.note(p,'Aprovou',section);
        if p.art_status='approved' and p.caption_status='approved' then
            perform portal_private.event(p.client_id,p.id,null,'review','Post pronto para revisão final',p.title,'team',responsible);
        end if;
    when 'changes' then
        if team then raise exception 'A solicitação precisa vir de um aprovador.'; end if;
        update public.portal_posts set art_status=case when section='art' then 'changes' else art_status end,
            caption_status=case when section='caption' then 'changes' else caption_status end,released_at=null,revision=revision+1 where id=p.id returning * into p;
        perform portal_private.note(p,'Solicitou alterações',section,input_text);
        perform portal_private.event(p.client_id,p.id,null,'changes','Alteração solicitada',
            p.title||' · '||case when section='art' then 'Arte' else 'Legenda' end,'team',responsible);
    when 'reject' then
        if team then raise exception 'A recusa precisa vir de um aprovador.'; end if;
        update public.portal_posts set rejection=input_text,released_at=null,revision=revision+1 where id=p.id returning * into p;
        perform portal_private.note(p,'Recusou o post',null,input_text);
        perform portal_private.event(p.client_id,p.id,null,'rejected','Post recusado',p.title,'team',responsible);
    when 'edit_caption', 'suggest', 'minor' then
        if op='edit_caption' and team then raise exception 'Use a revisão de legenda da equipe.'; end if;
        if p.rejection is not null or input_text=p.caption then raise exception 'Edite a legenda de um post em andamento.'; end if;
        if op='minor' and p.caption_status<>'approved' then raise exception 'A legenda ainda precisa da aprovação do cliente.'; end if;
        if op='minor' and payload->>'confirm_minor' is distinct from 'true' then raise exception 'Confirme que o ajuste é só de digitação ou pontuação.'; end if;
        perform portal_private.note(p,'Versão anterior da legenda','caption',p.caption);
        update public.portal_posts set caption=input_text,caption_version=caption_version+1,
            caption_status=case when op='suggest' then 'pending' else 'approved' end,
            released_at=case when op='minor' then released_at else null end,revision=revision+1 where id=p.id returning * into p;
        perform portal_private.note(p,case op when 'suggest' then 'Sugeriu legenda' when 'minor' then 'Corrigiu digitação ou pontuação'
            else 'Editou e aprovou a legenda' end,'caption',input_text);
        if op='suggest' and p.shared_at is not null then
            perform portal_private.event(p.client_id,p.id,null,'caption','Nova legenda para aprovação',p.title,'client_approvers');
        elsif op='edit_caption' then
            perform portal_private.event(p.client_id,p.id,null,'changes','Legenda corrigida pelo cliente',p.title,'team',responsible);
        elsif p.released_at is not null then
            update public.publications set copy_text=p.caption where id=p.publication_id;
        end if;
    when 'resend' then
        if p.shared_at is not null and input_text='' then raise exception 'Descreva o que mudou na arte.'; end if;
        perform portal_private.store_art(p,payload->'files',p.art_version+1);
        update public.portal_posts set art_version=art_version+1,art_status='pending',rejection=null,released_at=null,revision=revision+1
            where id=p.id returning * into p;
        perform portal_private.note(p,'Adicionou nova arte','art',input_text);
        if p.shared_at is not null then
            perform portal_private.event(p.client_id,p.id,null,'art','Nova arte para aprovação',p.title,'client_approvers');
        end if;
    when 'share_history' then
        if p.published_at is null or p.art_version=0 or p.shared_at is not null then raise exception 'Anexe a arte final de um post publicado.'; end if;
        if not exists(select 1 from public.publications q join public.clients c on c.name=q.client_name
            where q.id=p.publication_id and q.status='POSTADO' and c.id=p.client_id) then
            raise exception 'Confira a empresa e a publicação original antes de compartilhar.';
        end if;
        update public.portal_posts set shared_at=now(),released_at=coalesce(released_at,now()),art_status='approved',caption_status='approved',
            revision=revision+1 where id=p.id returning * into p;
        perform portal_private.note(p,'Compartilhou no histórico');
    when 'release' then
        if p.released_at is not null or p.shared_at is null or p.rejection is not null or p.art_status<>'approved' or p.caption_status<>'approved'
        then raise exception 'A arte e a legenda precisam estar aprovadas e o post em revisão.'; end if;
        update public.portal_posts set released_at=now(),revision=revision+1 where id=p.id returning * into p;
        update public.publications set status='AGENDADO',copy_text=p.caption,assets_ready=true,reminder_sent=false,due_sent=false
            where id=p.publication_id;
        perform portal_private.note(p,'Concluiu a revisão final');
    when 'date' then
        stamp:=(((payload->>'date')::date)+(p.scheduled_at at time zone 'America/Sao_Paulo')::time) at time zone 'America/Sao_Paulo';
        if stamp is null or stamp=p.scheduled_at then raise exception 'Escolha uma data diferente.'; end if;
        if p.publication_id is not null then
            update public.publications set scheduled_for=stamp where id=p.publication_id;
        else
            update public.portal_posts set scheduled_at=stamp,revision=revision+1 where id=p.id;
            if p.shared_at is not null then
                input_text:=p.title||' · '||to_char(p.scheduled_at at time zone 'America/Sao_Paulo','DD/MM')||' → '||
                    to_char(stamp at time zone 'America/Sao_Paulo','DD/MM');
                perform portal_private.event(p.client_id,p.id,null,'date','Data de publicação alterada',input_text,'client_all');
            end if;
        end if;
    when 'publish' then
        if p.released_at is null then raise exception 'Conclua a revisão final antes de registrar a publicação.'; end if;
        stamp:=((payload->>'date')::date + localtime) at time zone 'America/Sao_Paulo';
        if stamp is null then raise exception 'Informe a data da publicação.'; end if;
        update public.portal_posts set published_at=stamp,revision=revision+1 where id=p.id returning * into p;
        update public.publications set status='POSTADO' where id=p.publication_id;
        perform portal_private.note(p,'Registrou a publicação');
    else raise exception 'Ação inválida.';
    end case;
    if op in ('changes','reject','edit_caption','suggest','resend') and p.shared_at is not null and p.released_at is null then
        update public.publications set status='CRIANDO',reminder_sent=true,due_sent=true where id=p.publication_id;
    end if;
    return jsonb_build_object('id',p.id);
end;
$$;
create function public.portal_action(op text,payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
    select portal_private.action(op,payload);
$$;

revoke execute on all functions in schema portal_private from public, anon, authenticated, service_role;
grant execute on function portal_private.email(),portal_private.is_team(boolean),portal_private.has_client(uuid,boolean),
    portal_private.can_subscribe(),portal_private.workspace(),portal_private.action(text,jsonb) to authenticated;
revoke execute on function public.portal_workspace(),public.portal_action(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.portal_workspace(),public.portal_action(text,jsonb) to authenticated;

create table portal_private.worker_state (
    singleton boolean primary key check(singleton),
    whatsapp_active boolean not null,
    checked_at timestamptz not null default now()
);
create function portal_private.settings() returns jsonb
language sql stable security definer set search_path = '' as $$
    select case when portal_private.is_team() then jsonb_build_object(
      'whatsapp_active', coalesce((select whatsapp_active and checked_at>now()-interval '15 minutes' from portal_private.worker_state),false),
      'phone',(select phone from portal_private.team_phones where email=portal_private.email()))
      else '{}'::jsonb end;
$$;
create function public.portal_settings() returns jsonb language sql stable security invoker set search_path = '' as $$
    select portal_private.settings();
$$;
revoke all on function portal_private.settings(),public.portal_settings() from public,anon,authenticated,service_role;
grant execute on function portal_private.settings(),public.portal_settings() to authenticated;

create function portal_private.claim(whatsapp_ready boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare overdue public.portal_batches; total integer; queued jsonb;
begin
    insert into portal_private.worker_state(singleton,whatsapp_active) values(true,whatsapp_ready)
    on conflict(singleton) do update set whatsapp_active=excluded.whatsapp_active,checked_at=now();
    for overdue in select * from public.portal_batches where due_at<=now() and reminded_at is null
        order by due_at limit 30 for update skip locked loop
        update public.portal_batches set reminded_at=now() where id=overdue.id;
        select count(*) into total from public.portal_posts where batch_id=overdue.id and published_at is null and released_at is null
            and rejection is null and (art_status='pending' or caption_status='pending');
        if total>0 and overdue.due_at>now()-interval '2 days' then
            perform portal_private.event(overdue.client_id,null,overdue.id,'overdue','Prazo de aprovação encerrado',
                'Revise os posts pendentes assim que puder para ajudar a manter o calendário previsto.','client_approvers');
        end if;
    end loop;
    update portal_private.delivery set state='failed' where channel='whatsapp' and state='leased' and leased_at<now()-interval '10 minutes';
    update portal_private.delivery d set state='skipped' from public.portal_notices n
     where n.id=d.notice_id and d.state='pending' and n.created_at<now()-interval '2 days';
    with picked as (
      select d.id from portal_private.delivery d where
        (d.state='pending' or (d.channel='push' and d.state='leased' and d.leased_at<now()-interval '10 minutes'))
        and d.available_at<=now() and (d.channel='push' or whatsapp_ready)
      order by d.available_at,d.id limit 30 for update skip locked
    ), leased as (
      update portal_private.delivery d set state='leased',attempts=attempts+1,leased_at=now()
        from picked where d.id=picked.id returning d.*
    )
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'attempts',d.attempts,'channel',d.channel,'destination',d.destination,
        'kind',n.kind,'title',n.title,'body',n.body,'client_id',n.client_id,'post_id',n.post_id,'batch_id',n.batch_id,
        'device',case when dev.endpoint is not null then jsonb_build_object('endpoint',dev.endpoint,'p256dh',dev.p256dh,'auth',dev.auth) end,
        'allowed',case when n.kind in ('changes','rejected','review') then
            exists(select 1 from public.team_members t left join portal_private.team_phones tp on tp.email=t.email
                where t.email=n.email and (d.channel='push' or tp.phone=d.destination))
        else exists(select 1 from public.portal_access a where a.client_id=n.client_id and a.email=n.email
            and (n.kind='date' or a.role='approve') and (d.channel='push' or (a.whatsapp_opt_in and a.phone=d.destination)))
        end and (n.kind<>'overdue' or exists(select 1 from public.portal_posts p where p.batch_id=n.batch_id and p.rejection is null
            and p.published_at is null and p.released_at is null and (p.art_status='pending' or p.caption_status='pending'))))), '[]'::jsonb)
      into queued from leased d join public.portal_notices n on n.id=d.notice_id
        left join public.portal_devices dev on d.channel='push' and dev.endpoint=d.destination and dev.email=n.email;
    return queued;
end;
$$;
create function portal_private.finish(job uuid, attempt integer, result text) returns void
language sql security definer set search_path = '' as $$
    update portal_private.delivery set state=case when result='retry' and attempts<4 then 'pending'
       when result in ('sent','skipped') then result else 'failed' end, available_at=now()+attempts*interval '5 minutes'
       where id=job and state='leased' and attempts=attempt;
$$;
create function public.portal_worker_claim(whatsapp_ready boolean) returns jsonb
language sql security invoker set search_path = '' as $$ select portal_private.claim(whatsapp_ready); $$;
create function public.portal_worker_finish(job uuid, attempt integer, result text) returns void
language sql security invoker set search_path = '' as $$ select portal_private.finish(job,attempt,result); $$;
revoke all on function portal_private.claim(boolean),portal_private.finish(uuid,integer,text),
  public.portal_worker_claim(boolean),public.portal_worker_finish(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function portal_private.claim(boolean),portal_private.finish(uuid,integer,text),
  public.portal_worker_claim(boolean),public.portal_worker_finish(uuid,integer,text) to service_role;
