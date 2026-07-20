import Link from "next/link";

import { Building2, FileText, MessageCircle, Palette } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  const sections = [
    {
      title: "Identité de l’agence",
      description: "Nom, logo, message d’accueil et coordonnées affichés par le bot à vos clients.",
      href: "/dashboard/parametres/identite",
      icon: Building2,
    },
    {
      title: "Bot WhatsApp",
      description: "Liaison des comptes et suivi des conversations.",
      href: "/dashboard/parametres/whatsapp",
      icon: MessageCircle,
    },
    {
      title: "Documents officiels",
      description: "Modèles et signatures de l’organisation.",
      href: "/dashboard/documents",
      icon: FileText,
    },
    {
      title: "Apparence",
      description: "Thème et préférences d’affichage.",
      href: "/dashboard/parametres",
      icon: Palette,
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-semibold text-2xl">Paramètres</h1>
        <p className="text-muted-foreground text-sm">Configuration de votre organisation.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.title} href={section.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-center gap-3">
                <section.icon className="text-primary" />
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">{section.description}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
