import { listUsers } from "@/services/utilisateurs-service";

import { UtilisateursModule } from "../utilisateurs/_components/utilisateurs-module";

export default async function Page() {
  return (
    <UtilisateursModule
      initialPayload={await listUsers()}
      fixedMemberType="tenant"
      title="Locataires"
      description="Locataires actifs, invitations et historique des comptes."
    />
  );
}
