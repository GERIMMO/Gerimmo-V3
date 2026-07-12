import { listIncidents } from "@/services/incidents-service";
import { listPatrimoine } from "@/services/patrimoine-service";
import { listUsers } from "@/services/utilisateurs-service";

import { IncidentsModule } from "./_components/incidents-module";

export default async function IncidentsPage() {
  const [payload, patrimoine, users] = await Promise.all([listIncidents(), listPatrimoine(), listUsers()]);
  return (
    <IncidentsModule
      initialPayload={payload}
      biens={patrimoine.biens.map((bien) => ({
        id: bien.id,
        organizationId: bien.organization_id,
        label: `${bien.reference} - ${bien.name}`,
      }))}
      responsables={users.users.map((user) => ({ id: user.profile_id, label: user.full_name }))}
    />
  );
}
