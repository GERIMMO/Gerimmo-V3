import { Alert, AlertDescription } from "@/components/ui/alert";

export function AuthMessage({ message, success = false }: { message?: string; success?: boolean }) {
  if (!message) return null;
  return (
    <Alert variant={success ? "default" : "destructive"}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
