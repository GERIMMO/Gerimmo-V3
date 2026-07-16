import { Construction } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function AdminModulePlaceholder({ title }: { readonly title: string }) {
  return (
    <section className="flex min-h-[55vh] items-center justify-center">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <Construction />
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>Module en préparation</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}
