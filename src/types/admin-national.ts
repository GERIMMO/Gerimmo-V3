export type AdminNationalValue = string | number | boolean | null;

export type AdminNationalFormat = "text" | "status" | "date" | "money" | "boolean";

export interface AdminNationalColumn {
  readonly key: string;
  readonly label: string;
  readonly format?: AdminNationalFormat;
}

export interface AdminNationalRow {
  readonly id: string;
  readonly title: string;
  readonly organizationName: string | null;
  readonly values: Readonly<Record<string, AdminNationalValue>>;
}

export interface AdminNationalPayload {
  readonly section: string;
  readonly title: string;
  readonly description: string;
  readonly sourceLabel: string;
  readonly total: number;
  readonly shown: number;
  readonly columns: readonly AdminNationalColumn[];
  readonly rows: readonly AdminNationalRow[];
  readonly statusKey?: string;
}
