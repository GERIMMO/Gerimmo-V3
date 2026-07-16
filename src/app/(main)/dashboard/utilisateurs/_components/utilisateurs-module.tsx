"use client";

import { useMemo, useState } from "react";

import {
  Archive,
  History,
  type LucideIcon,
  MailPlus,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GerimmoUser, UserMemberType, UserStatus, UsersPayload } from "@/types/utilisateurs";

const memberLabels: Record<UserMemberType, string> = {
  admin: "Administrateur agence",
  agent: "Agent immobilier",
  owner: "Proprietaire bailleur",
  contractor: "Artisan",
  tenant: "Locataire",
};
const statusLabels: Record<UserStatus, string> = {
  invited: "Invite",
  active: "Actif",
  inactive: "Inactif",
  suspended: "Suspendu",
  archived: "Archive",
};
const invitationRoles: Record<UserMemberType, string> = {
  admin: "administrateur_agence",
  agent: "agent_immobilier",
  owner: "proprietaire",
  contractor: "artisan",
  tenant: "locataire",
};

interface UtilisateursModuleProps {
  readonly initialPayload: UsersPayload;
  readonly fixedMemberType?: UserMemberType;
  readonly title?: string;
  readonly description?: string;
}

export function UtilisateursModule({
  initialPayload,
  fixedMemberType,
  title = "Utilisateurs",
  description = "Agences, équipes, propriétaires, locataires et artisans.",
}: UtilisateursModuleProps) {
  const [users, setUsers] = useState(initialPayload.users);
  const [invitations, setInvitations] = useState(initialPayload.invitations);
  const [activities, setActivities] = useState(initialPayload.activities);
  const [statusHistory, setStatusHistory] = useState(initialPayload.statusHistory);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialPayload.users.at(0)?.profile_id ?? null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<UserMemberType | "tous">(fixedMemberType ?? "tous");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "tous">("tous");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const selectedUser = users.find((user) => user.profile_id === selectedUserId) ?? null;
  const visibleUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          `${user.full_name} ${user.email} ${user.organization_name}`.toLowerCase().includes(query.toLowerCase()) &&
          (typeFilter === "tous" || user.member_type === typeFilter) &&
          (statusFilter === "tous" || user.status === statusFilter),
      ),
    [query, statusFilter, typeFilter, users],
  );
  async function reload() {
    const response = await fetch("/api/utilisateurs", { cache: "no-store" });
    if (!response.ok) throw new Error("Actualisation impossible.");
    const payload = (await response.json()) as UsersPayload;
    setUsers(payload.users);
    setInvitations(payload.invitations);
    setActivities(payload.activities);
    setStatusHistory(payload.statusHistory);
  }
  async function setUserStatus(status: UserStatus) {
    if (!selectedUser) return;
    const response = await fetch(`/api/utilisateurs/${selectedUser.profile_id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organization_id: selectedUser.organization_id, status }),
    });
    if (!response.ok) throw new Error("Statut impossible à modifier.");
    await reload();
  }
  function updateSelectedUser(field: keyof GerimmoUser, value: GerimmoUser[keyof GerimmoUser]) {
    if (!selectedUser) return;
    setUsers((items) =>
      items.map((user) => (user.profile_id === selectedUser.profile_id ? { ...user, [field]: value } : user)),
    );
  }
  async function saveSelectedUser() {
    if (!selectedUser) return;
    const response = await fetch(`/api/utilisateurs/${selectedUser.profile_id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organization_id: selectedUser.organization_id,
        full_name: selectedUser.full_name,
        phone: selectedUser.phone,
        job_title: selectedUser.job_title,
        city: selectedUser.city,
      }),
    });
    if (!response.ok) throw new Error("Profil impossible à enregistrer.");
    await reload();
  }
  async function inviteUser() {
    const organizationId = initialPayload.organizationId;
    if (!organizationId || !inviteEmail.trim()) return;
    const memberType = fixedMemberType ?? "agent";
    const response = await fetch("/api/utilisateurs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organization_id: organizationId,
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || inviteEmail.trim(),
        member_type: memberType,
        role_key: invitationRoles[memberType],
      }),
    });
    if (!response.ok) throw new Error("Invitation impossible.");
    setInviteEmail("");
    setInviteName("");
    setInviteOpen(false);
    await reload();
  }
  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen((value) => !value)}>
          <MailPlus />
          Inviter
        </Button>
      </div>
      {inviteOpen ? (
        <div className="grid gap-2 rounded-lg border bg-card p-3 md:grid-cols-[1fr_1fr_auto]">
          <Input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Nom complet" />
          <Input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            type="email"
            placeholder="adresse@exemple.fr"
          />
          <Button size="sm" onClick={inviteUser}>
            Envoyer l’invitation
          </Button>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label={title} value={visibleUsers.length} />
        <Metric label="Actifs" value={visibleUsers.filter((user) => user.status === "active").length} />
        <Metric label="Invitations" value={invitations.filter((item) => item.status === "pending").length} />
        <Metric label="Agences" value={new Set(users.map((user) => user.organization_id)).size} />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="Rechercher un utilisateur"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {!fixedMemberType ? (
          <Filter
            value={typeFilter}
            values={memberLabels}
            label="Tous roles"
            onChange={(value) => setTypeFilter(value as UserMemberType | "tous")}
          />
        ) : null}
        <Filter
          value={statusFilter}
          values={statusLabels}
          label="Tous statuts"
          onChange={(value) => setStatusFilter(value as UserStatus | "tous")}
        />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Organisation</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Derniere connexion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleUsers.map((user) => (
              <TableRow key={user.id} className="cursor-pointer" onClick={() => setSelectedUserId(user.profile_id)}>
                <TableCell>
                  <div className="font-medium">{user.full_name}</div>
                  <div className="text-muted-foreground text-xs">{user.email}</div>
                </TableCell>
                <TableCell>{user.organization_name}</TableCell>
                <TableCell>{memberLabels[user.member_type]}</TableCell>
                <TableCell>
                  <Badge variant={user.status === "active" ? "secondary" : "outline"}>
                    {statusLabels[user.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.last_seen_at ? new Date(user.last_seen_at).toLocaleString("fr-FR") : "Jamais"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {invitations.length ? (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 font-medium text-sm">Invitations</div>
          <div className="grid gap-2">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{invitation.email}</span>
                <Badge variant="outline">{invitation.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <Sheet open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
          {selectedUser ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedUser.full_name}</SheetTitle>
                <SheetDescription>
                  {selectedUser.organization_name} · {selectedUser.role_name}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-4">
                <section className="grid gap-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-medium text-sm">Profil complet</h2>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setUserStatus("suspended")}>
                        <UserX />
                        Suspendre
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setUserStatus("archived")}>
                        <Archive />
                        Archiver
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="Nom"
                      value={selectedUser.full_name}
                      onChange={(value) => updateSelectedUser("full_name", value)}
                    />
                    <Field
                      label="Telephone"
                      value={selectedUser.phone ?? ""}
                      onChange={(value) => updateSelectedUser("phone", value)}
                    />
                    <Field
                      label="Fonction"
                      value={selectedUser.job_title ?? ""}
                      onChange={(value) => updateSelectedUser("job_title", value)}
                    />
                    <Field
                      label="Ville"
                      value={selectedUser.city ?? ""}
                      onChange={(value) => updateSelectedUser("city", value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={saveSelectedUser}>
                      Enregistrer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setUserStatus("active")}>
                      <UserCheck />
                      Activer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setUserStatus("inactive")}>
                      <UserRound />
                      Inactif
                    </Button>
                  </div>
                </section>
                <Section
                  icon={ShieldCheck}
                  title="Role et organisation"
                  lines={[
                    selectedUser.organization_name,
                    selectedUser.role_name,
                    memberLabels[selectedUser.member_type],
                  ]}
                />
                <Section
                  icon={History}
                  title="Historique"
                  lines={statusHistory
                    .filter((item) => item.profile_id === selectedUser.profile_id)
                    .map(
                      (item) =>
                        `${statusLabels[item.next_status]} · ${new Date(item.created_at).toLocaleString("fr-FR")}`,
                    )}
                />
                <Section
                  icon={History}
                  title="Journal d'activite"
                  lines={activities
                    .filter((item) => item.profile_id === selectedUser.profile_id)
                    .map((item) => `${item.action} · ${new Date(item.created_at).toLocaleString("fr-FR")}`)}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
function Filter({
  value,
  values,
  label,
  onChange,
}: Readonly<{ value: string; values: Record<string, string>; label: string; onChange: (value: string) => void }>) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="tous">{label}</SelectItem>
        {Object.entries(values).map(([key, item]) => (
          <SelectItem key={key} value={key}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Metric({ label, value }: Readonly<{ label: string; value: number | string }>) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
}: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-8" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
function Section({ icon: Icon, title, lines }: Readonly<{ icon: LucideIcon; title: string; lines: string[] }>) {
  return (
    <section className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2 font-medium text-sm">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </div>
      <div className="grid gap-1 text-sm">
        {lines.length ? (
          lines.map((line) => <p key={line}>{line}</p>)
        ) : (
          <p className="text-muted-foreground">Aucune donnee.</p>
        )}
      </div>
    </section>
  );
}
