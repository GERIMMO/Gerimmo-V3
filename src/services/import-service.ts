import ExcelJS from "exceljs";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ImportEntity, ImportJob, ImportPreview, ImportRowPreview } from "@/types/administration";

import { requireSuperAdmin } from "./administration-service";
import { normalizeHeaders, parseCsv } from "./import-rules";
import { createHash, randomUUID } from "node:crypto";

const allowedEntities = new Set<ImportEntity>(["agency", "owner", "property", "tenant"]);
const requiredColumns: Record<ImportEntity, string[]> = {
  agency: ["name", "slug"],
  owner: ["name", "email"],
  property: ["organization_slug", "reference", "name"],
  tenant: ["organization_slug", "email", "name", "property_reference"],
};

async function parseWorkbook(file: File) {
  const workbook = new ExcelJS.Workbook();
  const bytes = Buffer.from(await file.arrayBuffer());
  await workbook.xlsx.load(bytes as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow((current) => {
    const values = Array.isArray(current.values) ? current.values : [];
    rows.push(values.slice(1).map((value) => String(value ?? "").trim()));
  });
  return rows;
}

function rowToRecord(headers: string[], values: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
}

function entityOf(record: Record<string, string>): ImportEntity | null {
  const value = record.entity_type?.toLowerCase() as ImportEntity;
  return allowedEntities.has(value) ? value : null;
}

function duplicateKey(entity: ImportEntity, record: Record<string, string>) {
  if (entity === "agency") return `organization:${record.slug.toLowerCase()}`;
  if (entity === "property")
    return `property:${record.organization_slug.toLowerCase()}:${record.reference.toLowerCase()}`;
  return `email:${record.email.toLowerCase()}`;
}

async function existingDuplicateKeys() {
  const admin = createAdminClient();
  const [organizations, properties, profiles, invitations] = await Promise.all([
    admin.from("organizations").select("slug"),
    admin.from("biens").select("reference,organizations!inner(slug)"),
    admin.from("profiles").select("email").not("email", "is", null),
    admin.from("user_invitations").select("email").in("status", ["pending", "accepted"]),
  ]);
  const keys = new Set<string>();
  for (const row of organizations.data ?? []) keys.add(`organization:${row.slug.toLowerCase()}`);
  for (const row of properties.data ?? []) {
    const organization = row.organizations as unknown as { slug?: string };
    if (organization?.slug) keys.add(`property:${organization.slug.toLowerCase()}:${row.reference.toLowerCase()}`);
  }
  for (const row of [...(profiles.data ?? []), ...(invitations.data ?? [])]) {
    if (row.email) keys.add(`email:${String(row.email).toLowerCase()}`);
  }
  return keys;
}

export async function previewImport(file: File): Promise<ImportPreview> {
  const { user } = await requireSuperAdmin();
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") throw new Error("Utilisez un fichier CSV ou XLSX.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Le fichier dépasse 15 Mo.");
  const rawRows = extension === "csv" ? parseCsv(await file.text()) : await parseWorkbook(file);
  if (rawRows.length < 2) throw new Error("Le fichier ne contient aucune donnée.");
  if (rawRows.length > 20_001) throw new Error("Un import est limité à 20 000 lignes.");
  const headers = normalizeHeaders(rawRows[0]);
  if (!headers.includes("entity_type")) throw new Error("La colonne entity_type est obligatoire.");
  const persisted = await existingDuplicateKeys();
  const seen = new Set<string>();
  const rows: ImportRowPreview[] = rawRows.slice(1).map((values, index) => {
    const source = rowToRecord(headers, values);
    const entity = entityOf(source);
    const errors = entity
      ? requiredColumns[entity].filter((column) => !source[column]).map((column) => `Champ ${column} manquant.`)
      : ["Type d’entité invalide."];
    const key = entity && errors.length === 0 ? duplicateKey(entity, source) : null;
    const duplicate = Boolean(key && (persisted.has(key) || seen.has(key)));
    if (key) seen.add(key);
    return {
      row_number: index + 2,
      entity_type: entity ?? "agency",
      source_data: source,
      normalized_data: source,
      status: errors.length ? "error" : duplicate ? "duplicate" : "valid",
      errors,
      duplicate_key: key,
    };
  });
  const admin = createAdminClient();
  const counts = {
    valid: rows.filter((row) => row.status === "valid").length,
    error: rows.filter((row) => row.status === "error").length,
    duplicate: rows.filter((row) => row.status === "duplicate").length,
  };
  const { data: job, error } = await admin
    .from("data_import_jobs")
    .insert({
      created_by: user.id,
      file_name: file.name,
      file_type: extension,
      status: counts.error ? "draft" : "validated",
      total_rows: rows.length,
      valid_rows: counts.valid,
      error_rows: counts.error,
      duplicate_rows: counts.duplicate,
      mapping: { headers },
    })
    .select("*")
    .single();
  if (error) throw error;
  const { error: rowsError } = await admin
    .from("data_import_rows")
    .insert(rows.map((row) => ({ import_job_id: job.id, ...row })));
  if (rowsError) throw rowsError;
  return { job: job as ImportJob, rows };
}

async function ensurePatrimoine(admin: ReturnType<typeof createAdminClient>, organizationId: string, actorId: string) {
  const existing = await admin
    .from("patrimoines")
    .select("id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (existing.data) return existing.data.id;
  const created = await admin
    .from("patrimoines")
    .insert({
      organization_id: organizationId,
      name: "Patrimoine principal",
      reference: "PRINCIPAL",
      created_by: actorId,
    })
    .select("id")
    .single();
  if (created.error) throw created.error;
  return created.data.id;
}

async function createInvitation(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  actorId: string,
  row: Record<string, string>,
  memberType: "owner" | "tenant",
) {
  const roleKey = memberType === "owner" ? "proprietaire" : "locataire";
  const tokenHash = createHash("sha256").update(randomUUID()).digest("hex");
  const invitation = await admin
    .from("user_invitations")
    .insert({
      organization_id: organizationId,
      email: row.email,
      full_name: row.name,
      member_type: memberType,
      role_key: roleKey,
      status: "pending",
      token_hash: tokenHash,
      invited_by: actorId,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    .select("id")
    .single();
  if (invitation.error) throw invitation.error;
  return invitation.data.id;
}

export async function executeImport(jobId: string) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();
  const jobResult = await admin.from("data_import_jobs").select("*").eq("id", jobId).single();
  if (jobResult.error) throw jobResult.error;
  const rowsResult = await admin
    .from("data_import_rows")
    .select("*")
    .eq("import_job_id", jobId)
    .in("status", ["valid", "error"])
    .order("row_number");
  if (rowsResult.error) throw rowsResult.error;
  await admin.from("data_import_jobs").update({ status: "processing" }).eq("id", jobId);
  let imported = Number(jobResult.data.processed_rows ?? 0);
  let failed = 0;
  for (const raw of rowsResult.data ?? []) {
    if (raw.status !== "valid") continue;
    const row = raw.normalized_data as Record<string, string>;
    try {
      let resultId: string;
      if (raw.entity_type === "agency") {
        const created = await admin
          .from("organizations")
          .insert({
            name: row.name,
            slug: row.slug,
            organization_type: "agency",
            status: "active",
            created_by: user.id,
          })
          .select("id")
          .single();
        if (created.error) throw created.error;
        resultId = created.data.id;
      } else {
        let organization = await admin
          .from("organizations")
          .select("id")
          .eq("slug", row.organization_slug || `owner-${row.email.split("@")[0]}`)
          .maybeSingle();
        if (!organization.data && raw.entity_type === "owner") {
          organization = await admin
            .from("organizations")
            .insert({
              name: row.name,
              slug: `owner-${row.email.split("@")[0].replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
              organization_type: "independent_owner",
              status: "active",
              created_by: user.id,
            })
            .select("id")
            .single();
        }
        if (!organization.data) throw new Error("Organisation introuvable.");
        if (raw.entity_type === "property") {
          const patrimoineId = await ensurePatrimoine(admin, organization.data.id, user.id);
          const created = await admin
            .from("biens")
            .insert({
              organization_id: organization.data.id,
              patrimoine_id: patrimoineId,
              reference: row.reference,
              name: row.name,
              type: row.type || "appartement",
              status: row.status || "vacant",
              address_line1: row.address_line1 || null,
              postal_code: row.postal_code || null,
              city: row.city || null,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (created.error) throw created.error;
          resultId = created.data.id;
        } else {
          resultId = await createInvitation(
            admin,
            organization.data.id,
            user.id,
            row,
            raw.entity_type === "owner" ? "owner" : "tenant",
          );
        }
      }
      await admin
        .from("data_import_rows")
        .update({ status: "imported", result_record_id: resultId, processed_at: new Date().toISOString(), errors: [] })
        .eq("id", raw.id);
      imported += 1;
    } catch (error) {
      failed += 1;
      await admin
        .from("data_import_rows")
        .update({
          status: "error",
          errors: [error instanceof Error ? error.message : "Erreur d’import"],
          processed_at: new Date().toISOString(),
        })
        .eq("id", raw.id);
    }
  }
  const status = failed ? "partial" : "completed";
  const { data, error } = await admin
    .from("data_import_jobs")
    .update({
      status,
      processed_rows: imported,
      error_rows: Number(jobResult.data.error_rows) + failed,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", jobId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ImportJob;
}

export async function listImportJobs(): Promise<ImportJob[]> {
  await requireSuperAdmin();
  const { data, error } = await createAdminClient()
    .from("data_import_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data as ImportJob[];
}
