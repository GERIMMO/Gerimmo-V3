"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type AuthActionState = { message?: string; success?: boolean } | undefined;

const credentialsSchema = z.object({
  email: z.email("Adresse e-mail invalide.").trim(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});

export async function loginAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Informations invalides." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { message: "E-mail ou mot de passe incorrect." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", data.user.id)
    .is("archived_at", null)
    .maybeSingle();
  redirect(profile?.is_super_admin ? "/admin" : "/dashboard/accueil");
}

export async function forgotPasswordAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = z.email("Adresse e-mail invalide.").safeParse(formData.get("email"));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin ?? ""}/auth/callback?next=/auth/update-password`,
  });
  if (error) return { message: "L’envoi du lien a échoué. Réessayez dans quelques instants." };
  return { success: true, message: "Un lien sécurisé a été envoyé si ce compte existe." };
}

export async function updatePasswordAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) return { message: "Le mot de passe doit contenir au moins 8 caractères." };
  if (password !== confirmation) return { message: "Les mots de passe ne correspondent pas." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: "Le mot de passe n’a pas pu être enregistré." };
  return { success: true, message: "Mot de passe enregistré. Vous pouvez continuer." };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/v2/login");
}

export async function signupBusinessAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = credentialsSchema
    .extend({ fullName: z.string().min(2, "Nom requis."), accountType: z.enum(["agency", "independent_owner"]) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      fullName: formData.get("full_name"),
      accountType: formData.get("account_type"),
    });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Informations invalides." };
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, account_type: parsed.data.accountType },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard/onboarding`,
    },
  });
  if (error) return { message: "La création du compte a échoué." };
  return { success: true, message: "Compte créé. Consultez votre e-mail pour confirmer votre accès." };
}
