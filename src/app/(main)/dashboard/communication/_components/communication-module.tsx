"use client";

import { useMemo, useRef, useState } from "react";

import {
  Activity,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  FileText,
  Mail,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  CommunicationNotification,
  CommunicationPayload,
  CommunicationPreferences,
  NotificationType,
} from "@/types/communication";

const notificationLabels: Record<NotificationType, string> = {
  systeme: "Systeme",
  incident: "Incidents",
  document: "Documents",
  loyer: "Loyers",
  devis: "Devis",
  intervention: "Interventions",
};

export function CommunicationModule({ initialPayload }: { initialPayload: CommunicationPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [query, setQuery] = useState("");
  const [notificationType, setNotificationType] = useState("toutes");
  const [notificationDrawer, setNotificationDrawer] = useState<CommunicationNotification | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState(initialPayload.conversations.at(0)?.id ?? "");
  const [messageBody, setMessageBody] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh(): Promise<void> {
    const response = await fetch("/api/communication");
    if (!response.ok) {
      toast.error("Actualisation impossible.");
      return;
    }
    setPayload((await response.json()) as CommunicationPayload);
  }

  const filteredNotifications = useMemo(
    () =>
      payload.notifications.filter((notification) => {
        const matchesQuery = `${notification.title} ${notification.body}`.toLowerCase().includes(query.toLowerCase());
        const matchesType = notificationType === "toutes" || notification.notification_type === notificationType;
        return matchesQuery && matchesType;
      }),
    [notificationType, payload.notifications, query],
  );

  const filteredConversations = useMemo(
    () =>
      payload.conversations.filter((conversation) => conversation.subject.toLowerCase().includes(query.toLowerCase())),
    [payload.conversations, query],
  );
  const selectedConversation = payload.conversations.find((item) => item.id === selectedConversationId) ?? null;
  const selectedMessages = payload.messages.filter((message) => message.conversation_id === selectedConversationId);

  async function markRead(notification: CommunicationNotification, read = true) {
    const response = await jsonAction("mark_notification", { notification_id: notification.id, read });
    if (!response.ok) return toast.error("Mise a jour impossible.");
    setNotificationDrawer(null);
    await refresh();
  }

  async function sendMessage() {
    if (!selectedConversation || !messageBody.trim()) return;
    setSending(true);
    const form = new FormData();
    form.set("conversation_id", selectedConversation.id);
    form.set("body", messageBody);
    for (const file of selectedFiles) form.append("files", file);
    const response = await fetch("/api/communication", { method: "POST", body: form });
    setSending(false);
    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      return toast.error(error.message ?? "Envoi impossible.");
    }
    setMessageBody("");
    setSelectedFiles([]);
    await refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Communication</h1>
          <p className="text-muted-foreground text-sm">Notifications, messages, activite et preferences.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher"
            className="pl-9"
          />
        </div>
      </div>

      <Tabs defaultValue="notifications" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full justify-start overflow-x-auto md:w-fit">
          <TabsTrigger value="notifications">
            <Bell />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare />
            Messages
          </TabsTrigger>
          <TabsTrigger value="activite">
            <Activity />
            Activite
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Settings2 />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="min-h-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Non lues"
              value={payload.notifications.filter((item) => !item.read_at).length}
              icon={BellRing}
            />
            <Metric
              label="Prioritaires"
              value={payload.notifications.filter((item) => ["haute", "urgente"].includes(item.priority)).length}
              icon={Bell}
            />
            <Metric label="Total" value={payload.notifications.length} icon={Check} />
          </div>
          <div className="flex justify-end">
            <Select value={notificationType} onValueChange={setNotificationType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Tous les types</SelectItem>
                {Object.entries(notificationLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Notification</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priorite</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.map((notification) => (
                  <TableRow key={notification.id} className={!notification.read_at ? "bg-muted/30" : undefined}>
                    <TableCell>
                      <div className="font-medium">{notification.title}</div>
                      <div className="max-w-xl truncate text-muted-foreground text-xs">{notification.body}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{notificationLabels[notification.notification_type]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={notification.priority === "urgente" ? "destructive" : "secondary"}>
                        {notification.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                      {formatDate(notification.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Consulter"
                        onClick={() => setNotificationDrawer(notification)}
                      >
                        <ChevronRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredNotifications.length === 0 ? (
              <EmptyState title="Aucune notification" description="Aucun element ne correspond aux filtres." />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="messages" className="min-h-0 flex-1">
          <div className="grid h-full min-h-[520px] overflow-hidden rounded-lg border bg-card lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
              <div className="flex items-center justify-between border-b p-3">
                <span className="font-medium text-sm">Conversations</span>
                <Button type="button" size="sm" onClick={() => setComposeOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Nouvelle
                </Button>
              </div>
              <div className="min-h-0 overflow-y-auto">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`flex w-full flex-col gap-1 border-b p-3 text-left hover:bg-muted/50 ${conversation.id === selectedConversationId ? "bg-muted" : ""}`}
                  >
                    <span className="font-medium text-sm">{conversation.subject}</span>
                    <span className="text-muted-foreground text-xs">{participantNames(payload, conversation.id)}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(conversation.last_message_at ?? conversation.created_at)}
                    </span>
                  </button>
                ))}
                {filteredConversations.length === 0 ? (
                  <EmptyState title="Aucune conversation" description="Creez un premier echange." />
                ) : null}
              </div>
            </div>
            <div className="flex min-h-0 flex-col">
              {selectedConversation ? (
                <>
                  <div className="border-b p-3">
                    <div className="font-medium">{selectedConversation.subject}</div>
                    <div className="text-muted-foreground text-xs">
                      {participantNames(payload, selectedConversation.id)}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                    {selectedMessages.map((message) => {
                      const mine = message.sender_profile_id === payload.currentProfileId;
                      const messageFiles = payload.attachments.filter((item) => item.message_id === message.id);
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                          >
                            <div>{message.body}</div>
                            {messageFiles.map((file) => (
                              <div key={file.id} className="mt-2 flex items-center gap-1 text-xs">
                                <FileText className="size-3" />
                                {file.file_name}
                              </div>
                            ))}
                            <div className="mt-1 text-right text-[11px] opacity-70">
                              {formatDate(message.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t p-3">
                    {selectedFiles.length ? (
                      <div className="mb-2 text-muted-foreground text-xs">
                        {selectedFiles.map((file) => file.name).join(", ")}
                      </div>
                    ) : null}
                    <div className="flex items-end gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                        onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Joindre des fichiers"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip />
                      </Button>
                      <Textarea
                        rows={2}
                        value={messageBody}
                        onChange={(event) => setMessageBody(event.target.value)}
                        placeholder="Ecrire un message"
                      />
                      <Button
                        type="button"
                        size="icon"
                        title="Envoyer"
                        disabled={sending || !messageBody.trim()}
                        onClick={sendMessage}
                      >
                        <Send />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState title="Selectionnez une conversation" description="Les messages apparaitront ici." />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activite" className="min-h-0 flex-1">
          <div className="overflow-hidden rounded-lg border bg-card">
            {payload.activity
              .filter((event) => `${event.title} ${event.action}`.toLowerCase().includes(query.toLowerCase()))
              .map((event) => (
                <div key={event.id} className="flex gap-3 border-b p-3 last:border-b-0">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Activity className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-sm">{event.title}</span>
                      <span className="text-muted-foreground text-xs">{formatDate(event.created_at)}</span>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {event.description ?? event.action.replaceAll("_", " ").toLowerCase()}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {event.category}
                    </Badge>
                  </div>
                </div>
              ))}
            {payload.activity.length === 0 ? (
              <EmptyState title="Aucune activite" description="Les actions importantes seront affichees ici." />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="min-h-0 flex-1">
          <PreferencesPanel preferences={payload.preferences} onSaved={refresh} />
        </TabsContent>
      </Tabs>

      <Sheet open={Boolean(notificationDrawer)} onOpenChange={(open) => !open && setNotificationDrawer(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {notificationDrawer ? (
            <>
              <SheetHeader>
                <SheetTitle>{notificationDrawer.title}</SheetTitle>
                <SheetDescription>
                  {notificationLabels[notificationDrawer.notification_type]} ·{" "}
                  {formatDate(notificationDrawer.created_at)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <Badge variant={notificationDrawer.priority === "urgente" ? "destructive" : "secondary"}>
                  {notificationDrawer.priority}
                </Badge>
                <p className="text-sm leading-6">{notificationDrawer.body}</p>
                {notificationDrawer.action_url ? (
                  <Button asChild>
                    <a href={notificationDrawer.action_url}>Ouvrir le dossier</a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(notificationDrawer.read_at)}
                  onClick={() => markRead(notificationDrawer)}
                >
                  <Check data-icon="inline-start" />
                  Marquer comme lue
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <NewConversationSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        payload={payload}
        onCreated={async () => {
          setComposeOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}

function NewConversationSheet({
  open,
  onOpenChange,
  payload,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: CommunicationPayload;
  onCreated: () => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  async function create() {
    setSaving(true);
    const response = await jsonAction("create_conversation", {
      organization_id: payload.organizationId,
      subject,
      participant_profile_ids: participants,
      first_message: message,
    });
    setSaving(false);
    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      return toast.error(error.message ?? "Creation impossible.");
    }
    setSubject("");
    setMessage("");
    setParticipants([]);
    toast.success("Conversation creee.");
    await onCreated();
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nouvelle conversation</SheetTitle>
          <SheetDescription>Selectionnez les participants et envoyez le premier message.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label>Objet</Label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Participants</Label>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
              {payload.profiles
                .filter((profile) => profile.id !== payload.currentProfileId)
                .map((profile) => (
                  <div key={profile.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`participant-${profile.id}`}
                      checked={participants.includes(profile.id)}
                      onCheckedChange={(checked) =>
                        setParticipants((current) =>
                          checked ? [...current, profile.id] : current.filter((id) => id !== profile.id),
                        )
                      }
                    />
                    <Label htmlFor={`participant-${profile.id}`}>
                      {profile.full_name ?? profile.email ?? "Utilisateur"}
                    </Label>
                  </div>
                ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Premier message</Label>
            <Textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={saving || !subject.trim() || !message.trim() || participants.length === 0}
            onClick={create}
          >
            <Send data-icon="inline-start" />
            Creer et envoyer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreferencesPanel({
  preferences,
  onSaved,
}: {
  preferences: CommunicationPreferences;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(preferences);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const response = await jsonAction("save_preferences", form);
    setSaving(false);
    if (!response.ok) return toast.error("Enregistrement impossible.");
    toast.success("Preferences enregistrees.");
    await onSaved();
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h2 className="font-medium">Canaux</h2>
          <p className="text-muted-foreground text-sm">Choisissez comment recevoir vos informations.</p>
        </div>
        <PreferenceSwitch
          icon={Bell}
          label="Application"
          description="Centre de notifications GERIMMO"
          checked={form.application_enabled}
          onCheckedChange={(checked) => setForm({ ...form, application_enabled: checked })}
        />
        <PreferenceSwitch
          icon={Mail}
          label="E-mail"
          description="Envois vers votre adresse de compte"
          checked={form.email_enabled}
          onCheckedChange={(checked) => setForm({ ...form, email_enabled: checked })}
        />
        <PreferenceSwitch
          icon={MessageSquare}
          label="Telegram"
          description="Preparation uniquement, aucun envoi dans ce module"
          checked={form.telegram_enabled}
          onCheckedChange={(checked) => setForm({ ...form, telegram_enabled: checked })}
        />
      </section>
      <section className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h2 className="font-medium">Categories</h2>
          <p className="text-muted-foreground text-sm">Selectionnez les evenements utiles.</p>
        </div>
        {Object.entries(notificationLabels).map(([type, label]) => (
          <PreferenceSwitch
            key={type}
            icon={Bell}
            label={label}
            description=""
            checked={form.categories[type as NotificationType]}
            onCheckedChange={(checked) => setForm({ ...form, categories: { ...form.categories, [type]: checked } })}
          />
        ))}
        <Button type="button" className="w-full" disabled={saving} onClick={save}>
          <Check data-icon="inline-start" />
          Enregistrer
        </Button>
      </section>
    </div>
  );
}

function PreferenceSwitch({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof Bell;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-muted-foreground" />
        <div>
          <div className="font-medium text-sm">{label}</div>
          {description ? <div className="text-muted-foreground text-xs">{description}</div> : null}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Bell }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div>
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="font-semibold text-2xl">{value}</div>
      </div>
      <Icon className="size-5 text-muted-foreground" />
    </div>
  );
}
function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border-0 py-10">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
function participantNames(payload: CommunicationPayload, conversationId: string) {
  return (
    payload.participants
      .filter((item) => item.conversation_id === conversationId && item.profile_id !== payload.currentProfileId)
      .map((item) => item.profiles?.full_name ?? item.profiles?.email ?? "Utilisateur")
      .join(", ") || "Moi"
  );
}
function jsonAction(action: string, payload: unknown) {
  return fetch("/api/communication", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
}
