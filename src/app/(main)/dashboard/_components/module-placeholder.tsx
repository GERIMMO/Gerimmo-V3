type ModulePlaceholderProps = {
  title: string;
};

export function ModulePlaceholder({ title }: ModulePlaceholderProps) {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="font-semibold text-2xl tracking-normal">{title}</h1>
      <p className="text-muted-foreground">Ce module sera developpe ensuite.</p>
    </section>
  );
}
