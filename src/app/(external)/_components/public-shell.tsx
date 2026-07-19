import Link from "next/link";

import { ArrowRight, Building2, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const links = [
  { href: "/pourquoi-gerimmo", label: "Pourquoi GERIMMO" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/demonstration", label: "Démonstration" },
  { href: "/aide", label: "Aide" },
];

export function PublicHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="size-4" />
          </span>
          <span>GERIMMO</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted-foreground text-sm hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/auth/v2/login">Connexion</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/auth/v2/signup">
              Essai gratuit
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button className="md:hidden" variant="ghost" size="icon" aria-label="Ouvrir le menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>GERIMMO</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-2 px-4">
              {links.map((link) => (
                <Button key={link.href} asChild variant="ghost" className="justify-start">
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ))}
              <Button asChild>
                <Link href="/auth/v2/signup">Commencer l’essai</Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1fr_auto_auto] lg:px-8">
        <div>
          <div className="font-semibold">GERIMMO</div>
          <p className="mt-2 max-w-sm text-muted-foreground text-sm">
            La plateforme française qui simplifie la gestion immobilière, de l’incident au rapport final.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Découvrir</span>
          <Link href="/tarifs" className="text-muted-foreground">
            Tarifs
          </Link>
          <Link href="/demonstration" className="text-muted-foreground">
            Démonstration
          </Link>
          <Link href="/pourquoi-gerimmo" className="text-muted-foreground">
            Pourquoi GERIMMO
          </Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Nous contacter</span>
          <Link href="/contact" className="text-muted-foreground">
            Demander une démonstration
          </Link>
          <Link href="/aide" className="text-muted-foreground">
            Centre d’aide
          </Link>
          <Link href="/confidentialite" className="text-muted-foreground">
            Confidentialité
          </Link>
          <Link href="/auth/v2/login" className="text-muted-foreground">
            Connexion
          </Link>
        </div>
      </div>
      <div className="border-t px-5 py-5 text-center text-muted-foreground text-xs">
        © 2026 GERIMMO. Données hébergées en Europe.
      </div>
    </footer>
  );
}

export function CtaBand() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-5 py-16 text-center">
        <h2 className="max-w-2xl font-semibold text-3xl">
          Votre gestion immobilière mérite mieux qu’une suite de fichiers et de relances.
        </h2>
        <p className="max-w-xl text-primary-foreground/75">
          Testez GERIMMO pendant 14 jours. Toutes les fonctionnalités sont disponibles, sans carte bancaire.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/auth/v2/signup">
              Commencer gratuitement
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link href="/contact">Voir une démonstration</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
