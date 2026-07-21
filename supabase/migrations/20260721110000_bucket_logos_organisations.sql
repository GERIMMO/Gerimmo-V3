-- Espace de stockage des logos d'organisation.
--
-- Public en lecture : un logo est une marque, pas une donnée sensible, et il doit s'afficher
-- partout (bot, e-mails, en-tête des documents) via une URL simple. L'écriture reste
-- réservée à qui gère l'organisation. Le chemin commence par l'id de l'organisation :
-- `<organization_id>/logo-<horodatage>.<ext>`.
--
-- (La signature manuscrite, elle, ira dans le bucket `documents` — privé — car c'est une
-- donnée réutilisable et sensible. Elle fait l'objet d'une étape distincte.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-logos', 'organization-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists org_logos_select on storage.objects;
create policy org_logos_select on storage.objects for select
using (bucket_id = 'organization-logos');

drop policy if exists org_logos_insert on storage.objects;
create policy org_logos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-logos'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
);

drop policy if exists org_logos_update on storage.objects;
create policy org_logos_update on storage.objects for update to authenticated
using (
  bucket_id = 'organization-logos'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
);

drop policy if exists org_logos_delete on storage.objects;
create policy org_logos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-logos'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
);
