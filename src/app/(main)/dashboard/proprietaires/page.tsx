import { listUsers } from "@/services/utilisateurs-service";

import { UtilisateursModule } from "../utilisateurs/_components/utilisateurs-module";

export default async function Page() {
  return (
    <UtilisateursModule
      initialPayload={await listUsers()}
      fixedMemberType="owner"
      title="Propriétaires bailleurs"
      description="Propriétaires rattachés à votre organisation."
    />
  );
}
