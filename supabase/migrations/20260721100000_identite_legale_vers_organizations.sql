-- L'identité légale d'une organisation (raison sociale, SIREN, adresse) vivait à deux
-- endroits : sur `organizations` (où les PDF la lisent) ET sur `organization_branding` (où
-- l'écran d'identité l'enregistrait). Conséquence : l'agence remplissait un formulaire que
-- les documents ignoraient. L'écran écrit désormais sur `organizations`, source unique.
--
-- Avant de retirer les colonnes en double de `organization_branding`, on rapatrie les
-- valeurs éventuellement saisies là — pour ne perdre aucune donnée d'une agence qui aurait
-- déjà rempli l'ancien formulaire.
update public.organizations o
set legal_name = coalesce(o.legal_name, b.legal_name),
    address_line1 = coalesce(o.address_line1, b.address_line1),
    postal_code = coalesce(o.postal_code, b.postal_code),
    city = coalesce(o.city, b.city)
from public.organization_branding b
where b.organization_id = o.id
  and (b.legal_name is not null or b.address_line1 is not null or b.postal_code is not null or b.city is not null);

alter table public.organization_branding
  drop column if exists legal_name,
  drop column if exists address_line1,
  drop column if exists postal_code,
  drop column if exists city;

-- `organization_branding` ne conserve que l'identité VISUELLE (logo, couleur, messages du
-- bot). `official_signature` y reste : c'est un libellé d'affichage, pas une donnée légale.
