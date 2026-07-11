import { requireUser } from "@/lib/auth/guards";
import { getCommunicationPayload } from "@/services/communication-service";

import { CommunicationModule } from "./_components/communication-module";

export default async function Page() {
  await requireUser("/auth/v1/login");
  return <CommunicationModule initialPayload={await getCommunicationPayload()} />;
}
