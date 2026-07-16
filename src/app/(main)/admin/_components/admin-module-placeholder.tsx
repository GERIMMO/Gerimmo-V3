import type { LucideIcon } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function AdminModulePlaceholder({
  title,
  description,
  icon: Icon,
}: {
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="border-b pb-4">
        <h1 className="font-heading font-semibold text-2xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </header>
      <Empty className="min-h-[22rem] border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>Module en préparation</EmptyTitle>
          <EmptyDescription>
            L’architecture et les permissions sont prêtes. Aucune donnée fictive ni action provisoire n’est affichée.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}
