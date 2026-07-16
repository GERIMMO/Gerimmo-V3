export type SupervisionTargetType = "agency" | "owner" | "property" | "tenant" | "contractor" | "user";

export interface SupervisionSearchResult {
  readonly type: SupervisionTargetType;
  readonly targetId: string;
  readonly organizationId: string;
  readonly label: string;
  readonly subtitle: string;
}

export interface SupervisionContextItem {
  readonly id: string;
  readonly type: SupervisionTargetType;
  readonly targetId: string;
  readonly organizationId: string;
  readonly label: string;
  readonly enteredAt: string;
}

export interface ActiveSupervision {
  readonly sessionId: string;
  readonly superAdminProfileId: string;
  readonly rootOrganizationId: string;
  readonly reason: string;
  readonly startedAt: string;
  readonly path: readonly SupervisionContextItem[];
  readonly current: SupervisionContextItem;
}

export interface SupervisionDataScope {
  readonly organizationId: string;
  readonly type: SupervisionTargetType;
  readonly targetId: string;
  readonly bienIds: readonly string[] | null;
  readonly profileIds: readonly string[] | null;
}

export interface SupervisionHistoryItem {
  readonly id: string;
  readonly administratorName: string;
  readonly organizationName: string;
  readonly reason: string;
  readonly status: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

export interface SupervisionEventItem {
  readonly id: string;
  readonly action: string;
  readonly route: string | null;
  readonly resourceType: string | null;
  readonly createdAt: string;
}

export interface SupervisionCenterPayload {
  readonly active: ActiveSupervision | null;
  readonly sessions: readonly SupervisionHistoryItem[];
  readonly events: readonly SupervisionEventItem[];
}
