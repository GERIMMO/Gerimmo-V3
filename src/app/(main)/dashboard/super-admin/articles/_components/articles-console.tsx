"use client";

import { useMemo, useState } from "react";

import { Archive, FilePenLine, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CmsArticle } from "@/types/administration";

const emptyForm = {
  title: "",
  summary: "",
  content: "",
  article_type: "article" as const,
  audience: "all" as const,
  status: "draft" as const,
};
type ArticleForm = Partial<CmsArticle> &
  Pick<CmsArticle, "title" | "summary" | "content" | "article_type" | "audience" | "status">;

export function ArticlesConsole({
  initialArticles,
  createOnMount = false,
}: {
  initialArticles: CmsArticle[];
  createOnMount?: boolean;
}) {
  const [articles, setArticles] = useState(initialArticles);
  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [open, setOpen] = useState(createOnMount);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      articles.filter((article) => `${article.title} ${article.summary}`.toLowerCase().includes(query.toLowerCase())),
    [articles, query],
  );
  function edit(article?: CmsArticle) {
    setForm(article ? { ...article } : emptyForm);
    setOpen(true);
  }
  async function save(status: "draft" | "published" | "archived") {
    const response = await fetch("/api/articles", {
      method: form.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, status }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message ?? "Enregistrement impossible.");
    setArticles((current) => [data as CmsArticle, ...current.filter((item) => item.id !== data.id)]);
    setOpen(false);
    toast.success(status === "published" ? "Publication en ligne." : "Brouillon enregistré.");
  }
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Publications</h1>
          <p className="text-muted-foreground text-sm">Articles, actualités, maintenance et nouveautés.</p>
        </div>
        <Button size="sm" onClick={() => edit()}>
          <Plus data-icon="inline-start" />
          Nouvelle publication
        </Button>
      </header>
      <div className="relative max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((article) => (
          <Card
            key={article.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => edit(article)}
          >
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{article.article_type}</Badge>
                <Badge variant={article.status === "published" ? "default" : "outline"}>{article.status}</Badge>
              </div>
              <div>
                <h2 className="font-medium">{article.title}</h2>
                <p className="line-clamp-3 text-muted-foreground text-sm">{article.summary}</p>
              </div>
              <div className="mt-auto text-muted-foreground text-xs">
                Mis à jour le {new Date(article.updated_at).toLocaleDateString("fr-FR")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{form.id ? "Modifier la publication" : "Nouvelle publication"}</SheetTitle>
            <SheetDescription>Le contenu ne sera visible qu’après publication.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            <Field label="Titre">
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </Field>
            <Field label="Résumé">
              <Textarea
                rows={3}
                value={form.summary}
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              />
            </Field>
            <Field label="Contenu">
              <Textarea
                rows={12}
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select
                  value={form.article_type}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, article_type: value as CmsArticle["article_type"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="news">Actualité</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="release">Nouveauté</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Audience">
                <Select
                  value={form.audience}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, audience: value as CmsArticle["audience"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="agencies">Agences</SelectItem>
                    <SelectItem value="independent_owners">Propriétaires</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {form.id && (
                <Button variant="destructive" onClick={() => save("archived")}>
                  <Archive data-icon="inline-start" />
                  Archiver
                </Button>
              )}
              <Button variant="outline" onClick={() => save("draft")}>
                <FilePenLine data-icon="inline-start" />
                Brouillon
              </Button>
              <Button onClick={() => save("published")}>
                <Send data-icon="inline-start" />
                Publier
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
