import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { listDocuments } from "@/services/documents-service";

import { DocumentsModule } from "./_components/documents-module";

export default async function Page() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  return (
    <DocumentsModule initialPayload={await listDocuments()} organizationId={membership?.organization_id ?? null} />
  );
}
