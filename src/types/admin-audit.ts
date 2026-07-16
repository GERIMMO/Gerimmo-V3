export interface AdminAuditEntry {
  readonly id: string;
  readonly createdAt: string;
  readonly actorId: string | null;
  readonly actorName: string;
  readonly actorEmail: string | null;
  readonly organizationId: string | null;
  readonly organizationName: string;
  readonly role: string;
  readonly module: string;
  readonly action: string;
  readonly resource: string;
  readonly route: string | null;
  readonly source: "audit" | "supervision";
}

export interface AdminAuditPayload {
  readonly entries: readonly AdminAuditEntry[];
  readonly limited: boolean;
}
