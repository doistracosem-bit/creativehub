insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reference-images', 'reference-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;

create policy "Equipe lê imagens de referências"
on storage.objects for select to authenticated
using (
  bucket_id = 'reference-images'
  and exists (
    select 1 from public.team_members
    where email = lower((select auth.jwt()) ->> 'email')
  )
);

create policy "Equipe envia imagens de referências"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'reference-images'
  and exists (
    select 1 from public.team_members
    where email = lower((select auth.jwt()) ->> 'email')
  )
);

-- Permite desfazer apenas o envio do próprio usuário quando o registro não foi salvo.
create policy "Equipe desfaz seu envio de imagem sem referência"
on storage.objects for delete to authenticated
using (
  bucket_id = 'reference-images'
  and owner_id = (select auth.uid())::text
  and exists (
    select 1 from public.team_members
    where email = lower((select auth.jwt()) ->> 'email')
  )
  and not exists (
    select 1 from public.references
    where image_url = 'storage:reference-images/' || storage.objects.name
  )
);
