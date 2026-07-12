import { getQualityCenter } from "@/services/quality-service";

import { QualityCenter } from "./_components/quality-center";

export default async function Page() {
  return <QualityCenter initialPayload={await getQualityCenter()} />;
}
