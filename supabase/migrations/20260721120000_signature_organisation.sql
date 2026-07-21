-- Signature manuscrite de l'organisation, pour l'apposer sur les documents.
--
-- Contrairement au logo (marque publique), une signature est une donnée SENSIBLE et
-- réutilisable : son bucket est PRIVÉ (aucune lecture publique). Le PDF l'incruste côté
-- serveur via le client d'administration ; l'aperçu dans l'écran passe par une URL signée à
-- durée courte. On ne stocke que le chemin, jamais une URL publique.
alter table public.organization_branding
  add column if not exists signature_path text;

comment on column public.organization_branding.signature_path is
  'Chemin de la signature manuscrite dans le bucket privé organization-signatures. Jamais public.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-signatures', 'organization-signatures', false, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lecture, écriture et suppression réservées à qui gère l'organisation (dossier = son id).
-- Aucune policy publique : le bucket reste privé.
drop policy if exists org_signatures_select on storage.objects;
create policy org_signatures_select on storage.objects for select to authenticated
using (
  bucket_id = 'organization-signatures'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
);

drop policy if exists org_signatures_insert on storage.objects;
create policy org_signatures_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-signatures'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
);

drop policy if exists org_signatures_update on storage.objects;
create policy org_signatures_update on storage.objects for update to authenticated
using (
  bucket_id = 'organization-signatures'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
);

drop policy if exists org_signatures_delete on storage.objects;
create policy org_signatures_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-signatures'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
);
