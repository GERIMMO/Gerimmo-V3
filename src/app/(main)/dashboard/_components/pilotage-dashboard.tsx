"use client";

import Link from "next/link";

import { ArrowRight, CircleAlert, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PilotagePayload } from "@/types/administration";

const severityLabels = { info: "Information", attention: "À surveiller", urgent: "Urgent" };

export function PilotageDashboard({ payload }: { payload: PilotagePayload }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Bonjour</h1>
          <p className="text-muted-foreground text-sm">Voici les priorités GERIMMO du moment.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/a-faire">
            Tout afficher
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {payload.metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-sm">{metric.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between">
                <span className="font-semibold text-3xl">{metric.value}</span>
                <ArrowRight className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>À traiter</CardTitle>
            <CircleAlert className="text-primary" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {payload.actions.slice(0, 7).map((action) => (
              <Link
                key={action.id}
                href={action.action_url ?? "/dashboard/a-faire"}
                className="flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">{action.title}</div>
                  <div className="truncate text-muted-foreground text-xs">{action.explanation}</div>
                </div>
                <Badge variant={action.severity === "urgent" ? "destructive" : "secondary"}>
                  {severityLabels[action.severity]}
                </Badge>
              </Link>
            ))}
            {payload.actions.length === 0 && (
              <p className="text-muted-foreground text-sm">Aucune action prioritaire.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Actualités GERIMMO</CardTitle>
            <Newspaper className="text-primary" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {payload.articles.map((article) => (
              <article key={article.id} className="border-b pb-3 last:border-0">
                <div className="font-medium text-sm">{article.title}</div>
                <p className="line-clamp-2 text-muted-foreground text-xs">{article.summary}</p>
              </article>
            ))}
            {payload.articles.length === 0 && (
              <p className="text-muted-foreground text-sm">Aucune publication récente.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
