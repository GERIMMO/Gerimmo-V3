import { requireUser } from "@/lib/auth/guards";
import { listTelegramAdminData } from "@/services/telegram-bot-service";

import { TelegramAdminModule } from "./_components/telegram-admin-module";

export default async function Page() {
  await requireUser("/auth/v1/login");
  const payload = await listTelegramAdminData();
  return <TelegramAdminModule initialPayload={payload} />;
}
