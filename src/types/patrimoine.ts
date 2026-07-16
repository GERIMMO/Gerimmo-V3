export type StatutBien = "vacant" | "occupe" | "travaux" | "archive";
export type TypeBien = "appartement" | "maison" | "local" | "parking" | "terrain" | "autre";

export type Patrimoine = {
  id: string;
  organization_id: string;
  name: string;
  reference: string;
  description: string | null;
  status: "active" | "archived";
  archived_at: string | null;
};

export type Residence = {
  id: string;
  organization_id: string;
  patrimoine_id: string;
  name: string;
  reference: string;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  status: "active" | "archived";
  archived_at: string | null;
};

export type Bien = {
  id: string;
  organization_id: string;
  patrimoine_id: string;
  residence_id: string | null;
  reference: string;
  name: string;
  type: TypeBien;
  status: StatutBien;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  floor: string | null;
  surface_m2: number | null;
  rooms: number | null;
  monthly_rent_cents: number;
  monthly_charges_cents: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type BienOccupant = {
  id: string;
  bien_id: string;
  full_name: string;
  occupant_type: "locataire" | "proprietaire" | "autre";
  started_at: string | null;
  ended_at: string | null;
};

export type BienEcheance = {
  id: string;
  bien_id: string;
  title: string;
  due_date: string;
  status: "a_prevoir" | "en_cours" | "terminee" | "archive";
  amount_cents: number | null;
};

export type BienHistorique = {
  id: string;
  bien_id: string | null;
  action: string;
  created_at: string;
};

export type PatrimoinePayload = {
  organizationId: string | null;
  patrimoines: Patrimoine[];
  residences: Residence[];
  biens: Bien[];
  occupants: BienOccupant[];
  echeances: BienEcheance[];
  historique: BienHistorique[];
};

export type CreatePatrimoineInput = Pick<Patrimoine, "organization_id" | "name" | "reference"> & {
  description?: string;
};

export type CreateResidenceInput = Pick<Residence, "organization_id" | "patrimoine_id" | "name" | "reference"> & {
  address_line1?: string;
  postal_code?: string;
  city?: string;
};

export type CreateBienInput = Pick<
  Bien,
  "organization_id" | "patrimoine_id" | "reference" | "name" | "type" | "status"
> &
  Partial<
    Pick<
      Bien,
      | "residence_id"
      | "address_line1"
      | "postal_code"
      | "city"
      | "floor"
      | "surface_m2"
      | "rooms"
      | "monthly_rent_cents"
      | "monthly_charges_cents"
    >
  >;

export type UpdateBienInput = Partial<CreateBienInput> & {
  id: string;
};
