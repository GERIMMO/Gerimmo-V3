import { listArticles } from "@/services/administration-service";

import { ArticlesConsole } from "./_components/articles-console";

export default async function Page() {
  return <ArticlesConsole initialArticles={await listArticles(true)} />;
}
