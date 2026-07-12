import { listPatrimoine } from "@/services/patrimoine-service";

import { PatrimoineModule } from "./_components/patrimoine-module";

export default async function Page() {
  return <PatrimoineModule initialPayload={await listPatrimoine()} />;
}
