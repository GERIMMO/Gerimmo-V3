import { listUsers } from "@/services/utilisateurs-service";

import { UtilisateursModule } from "../utilisateurs/_components/utilisateurs-module";

export default async function Page() {
  return (
    <UtilisateursModule
      initialPayload={await listUsers()}
      fixedMemberType="contractor"
      title="Artisans"
      description="Artisans autorisés à intervenir pour votre organisation."
    />
  );
}
