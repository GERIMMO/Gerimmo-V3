import { requireUser } from "@/lib/auth/guards";
import { listWhatsAppSettingsData } from "@/services/whatsapp-bot-service";

import { WhatsAppSettings } from "./_components/whatsapp-settings";

export default async function Page() {
  await requireUser("/auth/v1/login");
  const payload = await listWhatsAppSettingsData();

  return <WhatsAppSettings initialPayload={payload} />;
}
