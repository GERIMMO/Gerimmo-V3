import { RegisterForm } from "../_components/register-form";

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <section className="flex w-full max-w-sm flex-col gap-6 rounded-lg border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl">Sécuriser mon compte</h1>
          <p className="text-muted-foreground text-sm">Choisissez le mot de passe de votre accès GERIMMO.</p>
        </div>
        <RegisterForm />
      </section>
    </main>
  );
}
