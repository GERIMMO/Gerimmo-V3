"use client";

import { useState } from "react";

import { Ban, Copy, MessageCircle, Radio } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { WhatsAppSettingsPayload } from "@/services/whatsapp-bot-service";

function text(value: unknown) {
  return typeof value === "string" ? value : "-";
}

function date(value: unknown) {
  return typeof value === "string" ? new Date(value).toLocaleString("fr-FR") : "-";
}

export function WhatsAppSettings({ initialPayload }: { initialPayload: WhatsAppSettingsPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedMember, setSelectedMember] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ waLink: string | null; token: string } | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  async function subscribe() {
    setSubscribing(true);
    const response = await fetch("/api/bot/whatsapp/subscribe", { method: "POST" });
    setSubscribing(false);
    const body = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };
    if (!response.ok) return toast.error(body.message ?? "Abonnement impossible.");
    toast.success("Réception activée : le compte WhatsApp est abonné à l'application.");
  }

  const memberLabel = (member: WhatsAppSettingsPayload["members"][number]) =>
    [
      member.full_name ?? member.email ?? member.profile_id,
      member.organization_name ? `(${member.organization_name})` : null,
    ]
      .filter(Boolean)
      .join(" ");

  async function generate() {
    const member = payload.members.find((item) => `${item.organization_id}:${item.profile_id}` === selectedMember);
    if (!member) return toast.error("Choisissez d abord un membre.");
    setGenerating(true);
    const response = await fetch("/api/bot/whatsapp/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organization_id: member.organization_id, profile_id: member.profile_id }),
    });
    const body = (await response.json()) as {
      waLink: string | null;
      token: string;
      invitation: Record<string, unknown>;
      message?: string;
    };
    setGenerating(false);
    if (!response.ok) return toast.error(body.message ?? "Invitation impossible.");
    setGenerated({ waLink: body.waLink, token: body.token });
    setPayload((current) => ({ ...current, invitations: [body.invitation, ...current.invitations] }));
    toast.success("Lien de liaison genere (valable 30 minutes).");
  }

  async function revoke(invitationId: string) {
    setRevoking(invitationId);
    const response = await fetch("/api/bot/whatsapp/invitations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    setRevoking(null);
    if (!response.ok) return toast.error("Revocation impossible.");
    setPayload((current) => ({
      ...current,
      invitations: current.invitations.map((invitation) =>
        invitation.id === invitationId ? { ...invitation, status: "revoked" } : invitation,
      ),
    }));
    toast.success("Invitation revoquee.");
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Copie dans le presse-papiers.");
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="font-heading font-semibold text-xl tracking-normal">Bot WhatsApp</h1>
        <p className="text-muted-foreground text-sm">
          Liaison des comptes WhatsApp des membres (locataires, artisans) avec l assistant GERIMMO.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          label="Comptes lies"
          value={payload.accounts.filter((account) => account.status === "connected").length}
        />
        <Metric
          label="Invitations en attente"
          value={payload.invitations.filter((invitation) => invitation.status === "pending").length}
        />
        <Metric label="Membres eligibles" value={payload.members.length} />
      </div>

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <h2 className="font-medium text-sm">Activer la réception des messages</h2>
        <p className="text-muted-foreground text-sm">
          À faire une seule fois : abonne le compte WhatsApp Business à l&apos;application pour que les messages des
          membres soient bien transmis au bot.
        </p>
        <div>
          <Button type="button" variant="outline" disabled={subscribing} onClick={subscribe}>
            <Radio data-icon="inline-start" />
            Activer la réception
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <h2 className="font-medium text-sm">Generer un lien de liaison</h2>
        <p className="text-muted-foreground text-sm">
          Choisissez un membre puis envoyez-lui le lien : il ouvre WhatsApp avec un code pre-rempli qu il n a qu a
          envoyer au bot. Le lien expire au bout de 30 minutes.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-sm space-y-1.5">
            <Label>Membre</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un membre" />
              </SelectTrigger>
              <SelectContent>
                {payload.members.map((member) => (
                  <SelectItem
                    key={`${member.organization_id}:${member.profile_id}`}
                    value={`${member.organization_id}:${member.profile_id}`}
                  >
                    {memberLabel(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" disabled={generating || !selectedMember} onClick={generate}>
            <MessageCircle data-icon="inline-start" />
            Generer le lien
          </Button>
        </div>

        {generated ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
            {generated.waLink ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input readOnly value={generated.waLink} className="max-w-xl font-mono text-xs" />
                <Button type="button" variant="outline" size="sm" onClick={() => copy(generated.waLink ?? "")}>
                  <Copy data-icon="inline-start" />
                  Copier le lien
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input readOnly value={generated.token} className="max-w-xl font-mono text-xs" />
                <Button type="button" variant="outline" size="sm" onClick={() => copy(generated.token)}>
                  <Copy data-icon="inline-start" />
                  Copier le code
                </Button>
                <p className="text-muted-foreground text-xs">
                  Numero du bot non configure (WHATSAPP_BOT_NUMBER) : transmettez ce code au membre, a envoyer tel quel
                  au bot WhatsApp.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-sm">Comptes WhatsApp lies</h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Numero</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Derniere activite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.accounts.map((account) => (
                <TableRow key={text(account.id)}>
                  <TableCell className="font-medium">{text(account.display_name)}</TableCell>
                  <TableCell className="font-mono text-xs">{text(account.wa_id)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{text(account.status)}</Badge>
                  </TableCell>
                  <TableCell>{date(account.last_activity_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {payload.accounts.length === 0 ? (
            <EmptyState title="Aucune liaison" description="Aucun compte WhatsApp n est actuellement lie." />
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-sm">Invitations</h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statut</TableHead>
                <TableHead>Expire le</TableHead>
                <TableHead>Creee le</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.invitations.map((invitation) => (
                <TableRow key={text(invitation.id)}>
                  <TableCell>
                    <Badge variant={invitation.status === "pending" ? "default" : "outline"}>
                      {text(invitation.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{date(invitation.expires_at)}</TableCell>
                  <TableCell>{date(invitation.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={invitation.status !== "pending" || revoking === invitation.id}
                      onClick={() => revoke(text(invitation.id))}
                    >
                      <Ban data-icon="inline-start" />
                      Revoquer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {payload.invitations.length === 0 ? (
            <EmptyState title="Aucune invitation" description="Aucune invitation WhatsApp n a encore ete generee." />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-2xl">{value}</div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
