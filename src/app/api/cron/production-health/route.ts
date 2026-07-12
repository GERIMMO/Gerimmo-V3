import { registerBackupVerification, runProductionHealthCheck } from "@/services/monitoring-service";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) return Response.json({ message: "Accès refusé." }, { status: 401 });
  try {
    const [health, daily, weekly] = await Promise.all([
      runProductionHealthCheck(),
      registerBackupVerification("daily"),
      registerBackupVerification("weekly"),
    ]);
    return Response.json({ health, backups: [daily, weekly] });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Contrôle impossible." }, { status: 500 });
  }
}
