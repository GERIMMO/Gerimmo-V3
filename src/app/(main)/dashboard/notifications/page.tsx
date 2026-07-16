import { requireUser } from "@/lib/auth/guards";
import { getCommunicationPayload } from "@/services/communication-service";

import { CommunicationModule } from "../communication/_components/communication-module";

export default async function Page() {
  await requireUser();
  return <CommunicationModule initialPayload={await getCommunicationPayload()} initialTab="notifications" />;
}
