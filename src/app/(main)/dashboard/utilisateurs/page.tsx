import { listUsers } from "@/services/utilisateurs-service";

import { UtilisateursModule } from "./_components/utilisateurs-module";

export default async function Page() {
  return <UtilisateursModule initialPayload={await listUsers()} />;
}
