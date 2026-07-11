import type { NotificationType } from "../types/communication.ts";

export const defaultCommunicationCategories: Record<NotificationType, boolean> = {
  systeme: true,
  incident: true,
  document: true,
  loyer: true,
  devis: true,
  intervention: true,
};

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]);
const maximumFileSize = 10 * 1024 * 1024;

export function isCommunicationAttachmentAllowed(mimeType: string, size: number) {
  return allowedMimeTypes.has(mimeType) && size >= 1 && size <= maximumFileSize;
}

export function matchesCommunicationSearch(values: Array<string | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
  return normalizedQuery.length === 0 || values.join(" ").toLocaleLowerCase("fr-FR").includes(normalizedQuery);
}
