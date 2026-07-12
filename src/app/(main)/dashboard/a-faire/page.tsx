import { getPilotage } from "@/services/administration-service";

import { ActionCenter } from "./_components/action-center";

export default async function Page() {
  return <ActionCenter initialActions={(await getPilotage()).actions} />;
}
