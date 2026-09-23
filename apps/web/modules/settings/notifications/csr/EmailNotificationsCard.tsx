"use client";

import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import type { EmailSettingsFormInput } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMAIL_SECURITY_OPTIONS, type EmailSecurity, type EmailSettingsStatus } from "@/lib/types/email-settings";

interface EmailNotificationsCardProps {
  status: EmailSettingsStatus;
}

interface SmtpActionState {
  pending: boolean;
  result: { ok: boolean; message?: string; error?: string } | null;
}

const IDLE_STATE: SmtpActionState = { pending: false, result: null };

/**
 * Non-blocking heads-up only — a real SMTP server can legitimately run any
 * security mode on any port (roadmap: organization SMTP configuration, item
 * 10), so this never prevents Test Connection/Send Test Email/Save from
 * running.
 */
function unusualCombinationWarning(port: number, security: EmailSecurity): string | null {
  if (security === "ssl_tls" && port === 587) {
    return "Port 587 is normally used with STARTTLS, not SSL/TLS — this combination can still work if your provider supports it.";
  }
  if (security === "starttls" && port === 465) {
    return "Port 465 is normally used with SSL/TLS, not STARTTLS — this combination can still work if your provider supports it.";
  }
  if (security === "none" && (port === 465 || port === 587)) {
    return "Sending unencrypted over a port normally reserved for TLS/STARTTLS — double-check this is intended.";
  }
  return null;
}

function ResultBanner({ result }: { result: SmtpActionState["result"] }) {
  if (!result) return null;
  return (
    <Alert variant={result.ok ? "success" : "destructive"} className="mt-3">
      {result.ok ? <CheckCircle2 /> : <AlertCircle />}
      <AlertDescription>{result.ok ? result.message : result.error}</AlertDescription>
    </Alert>
  );
}

export function EmailNotificationsCard({ status }: EmailNotificationsCardProps) {
  const router = useRouter();
  const isEdit = status.configured;

  const [host, setHost] = useState(status.host ?? "");
  const [port, setPort] = useState(String(status.port ?? 587));
  const [security, setSecurity] = useState<EmailSecurity>(status.security ?? "starttls");
  const [username, setUsername] = useState(status.username ?? "");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(status.fromEmail ?? "");
  const [fromName, setFromName] = useState(status.fromName ?? "");

  const [testConnection, setTestConnection] = useState<SmtpActionState>(IDLE_STATE);
  const [testSend, setTestSend] = useState<SmtpActionState>(IDLE_STATE);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SmtpActionState["result"]>(null);

  const portNumber = Number(port);
  const warning = useMemo(
    () => (Number.isFinite(portNumber) && portNumber > 0 ? unusualCombinationWarning(portNumber, security) : null),
    [portNumber, security],
  );

  function buildInput(): EmailSettingsFormInput {
    return {
      host: host.trim(),
      port: portNumber,
      security,
      username: username.trim(),
      password: password || undefined,
      fromEmail: fromEmail.trim(),
      fromName: fromName.trim() || undefined,
    };
  }

  async function handleTestConnection() {
    setTestConnection({ pending: true, result: null });
    const result = await Actions.Email.testConnection(buildInput());
    setTestConnection({ pending: false, result });
  }

  async function handleSendTest() {
    setTestSend({ pending: true, result: null });
    const result = await Actions.Email.sendTestEmail(buildInput());
    setTestSend({ pending: false, result });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveResult(null);

    const { ok, body } = await Actions.Email.saveSettings(buildInput());
    setSaving(false);

    if (!ok) {
      setSaveResult({ ok: false, error: body.error ?? "Failed to save configuration" });
      return;
    }

    setPassword("");
    setSaveResult({ ok: true, message: "Configuration saved." });
    router.refresh();
  }

  const anyPending = testConnection.pending || testSend.pending || saving;

  return (
    <Card className="bg-surface-container-low rounded-xl border-0 shadow-sm p-6">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-0">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded bg-surface-container-highest text-primary">
            <Mail className="size-4" />
          </span>
          <div>
            <CardTitle className="text-on-surface text-xl font-semibold tracking-tight">Email notifications</CardTitle>
            <p className="text-sm text-on-surface-variant">
              SMTP server used to email at-risk and breach alerts to everyone in this organization.
            </p>
          </div>
        </div>
        <Badge variant={status.configured ? "success" : "outline"}>
          {status.configured ? "Configured" : "Not configured"}
        </Badge>
      </CardHeader>

      <CardContent className="p-0 pt-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="smtp.example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(event) => setPort(event.target.value)}
                placeholder="587"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-security">Security</Label>
              <Select value={security} onValueChange={(value) => setSecurity(value as EmailSecurity)}>
                <SelectTrigger id="smtp-security" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_SECURITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-username">Username</Label>
              <Input
                id="smtp-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="smtp username"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-password">Password</Label>
              <Input
                id="smtp-password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isEdit ? "Leave blank to keep the current password" : "SMTP password"}
                required={!isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-from-email">From Email</Label>
              <Input
                id="smtp-from-email"
                type="email"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
                placeholder="alerts@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp-from-name">From Name</Label>
            <Input
              id="smtp-from-name"
              value={fromName}
              onChange={(event) => setFromName(event.target.value)}
              placeholder="SLA Breach Monitoring"
            />
          </div>

          {warning && (
            <Alert variant="warning">
              <AlertCircle />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" size="sm" variant="surface" onClick={handleTestConnection} disabled={anyPending}>
              {testConnection.pending && <Loader2 className="animate-spin" />}
              {testConnection.pending ? "Testing…" : "Test Connection"}
            </Button>
            <Button type="button" size="sm" variant="surface" onClick={handleSendTest} disabled={anyPending}>
              {testSend.pending && <Loader2 className="animate-spin" />}
              {testSend.pending ? "Sending…" : "Send Test Email"}
            </Button>
            <Button type="submit" size="sm" disabled={anyPending}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save Configuration"}
            </Button>
          </div>

          <ResultBanner result={testConnection.result} />
          <ResultBanner result={testSend.result} />
          <ResultBanner result={saveResult} />
        </form>
      </CardContent>
    </Card>
  );
}
