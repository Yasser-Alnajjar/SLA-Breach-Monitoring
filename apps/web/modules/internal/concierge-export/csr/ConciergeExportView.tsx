"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileArchive, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  exportRequest,
  initialSelection,
  integrationsFailed,
  integrationsLoaded,
  selectIntegration,
  selectOrganization,
  type ConciergeExportSelection,
} from "@/lib/concierge-selection";
import { CONCIERGE_PROVIDER_COPY } from "@/lib/concierge-providers";
import type { ConciergeExportPageData, ConciergeExportSummary } from "@/lib/types/concierge-export";
import { SelectionField } from "./SelectionField";

interface ConciergeExportViewProps {
  data: ConciergeExportPageData;
}

interface CompletedExport {
  summary: ConciergeExportSummary;
  url: string;
}

/**
 * Internal operator page: export the Jira or Zendesk half of a Concierge
 * dataset from an integration the signed-in user can already access. Organization and
 * integration come from the session's own rows and are auto-selected when
 * there's only one; ids are never typed.
 */
export function ConciergeExportView({ data }: ConciergeExportViewProps) {
  const { provider } = data;
  const copy = CONCIERGE_PROVIDER_COPY[provider];
  const [selection, setSelection] = useState<ConciergeExportSelection>(() => initialSelection(data));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedExport | null>(null);
  const latestUrl = useRef<string | null>(null);

  useEffect(() => () => revoke(latestUrl), []);

  function clearResult() {
    revoke(latestUrl);
    setCompleted(null);
    setExportError(null);
  }

  async function handleOrganizationChange(organizationId: string) {
    const next = selectOrganization(selection, organizationId);
    if (next === selection) return;
    clearResult();
    setSelection(next);

    const result = await Actions.Concierge.listIntegrations(provider, organizationId);
    // Applied to the latest state: a reply for an organization that's no longer selected is dropped.
    setSelection((current) =>
      result.ok && result.integrations
        ? integrationsLoaded(current, organizationId, result.integrations)
        : integrationsFailed(current, organizationId, result.error ?? `Failed to load ${copy.label} integrations`),
    );
  }

  function handleIntegrationChange(integrationId: string) {
    clearResult();
    setSelection((current) => selectIntegration(current, integrationId));
  }

  async function handleExport() {
    const request = exportRequest(selection);
    if (!request) return;

    clearResult();
    setExporting(true);
    const result = await Actions.Concierge.exportData(provider, request);
    setExporting(false);

    if (!result.ok) {
      setExportError(result.error);
      return;
    }
    const url = URL.createObjectURL(result.zip);
    latestUrl.current = url;
    setCompleted({ summary: result.summary, url });
  }

  const request = exportRequest(selection);
  const { organizations, integrations } = selection;
  const selectedIntegration = integrations?.find((integration) => integration.id === selection.integrationId);
  const unavailable =
    integrations?.length === 1 && !integrations[0]!.exportable ? integrations[0]! : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={copy.integrationHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {copy.label} integration
      </Link>

      <div>
        <h2 className="text-base font-semibold">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">Export {copy.label} data for the Concierge SLA analysis.</p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
              <FileArchive className="size-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-semibold">Source</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{copy.sourceDescription}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 px-5 py-5">
          {organizations.length === 0 ? (
            <Alert variant="warning">
              <AlertCircle />
              <AlertDescription>You don&apos;t have access to any organization, so there is nothing to export.</AlertDescription>
            </Alert>
          ) : (
            <SelectionField
              id="concierge-organization"
              label="Organization"
              placeholder="Select organization"
              value={selection.organizationId}
              options={organizations.map((organization) => ({ value: organization.id, label: organization.name }))}
              disabled={exporting}
              onChange={handleOrganizationChange}
            />
          )}

          {selection.organizationId && (
            <IntegrationSection
              label={copy.label}
              selection={selection}
              exporting={exporting}
              unavailableReason={unavailable?.unavailableReason ?? selectedIntegration?.unavailableReason ?? null}
              onChange={handleIntegrationChange}
            />
          )}

          {exportError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="justify-end border-t px-5 py-4">
          <Button type="button" onClick={handleExport} disabled={!request || exporting}>
            {exporting && <Loader2 className="animate-spin" />}
            {exporting ? "Exporting…" : copy.exportButton}
          </Button>
        </CardFooter>
      </Card>

      {completed && (
        <Alert variant="success">
          <CheckCircle2 />
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div>
              <AlertTitle>Export complete</AlertTitle>
              <AlertDescription>
                <p>
                  {completed.summary.recordCount} {copy.recordNoun}
                </p>
                <p>
                  {completed.summary.historyCount} {copy.historyNoun}
                </p>
              </AlertDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={completed.url} download={completed.summary.fileName}>
                <Download />
                Download ZIP
              </a>
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}

interface IntegrationSectionProps {
  label: string;
  selection: ConciergeExportSelection;
  exporting: boolean;
  unavailableReason: string | null;
  onChange: (integrationId: string) => void;
}

function IntegrationSection({ label, selection, exporting, unavailableReason, onChange }: IntegrationSectionProps) {
  if (selection.loadingIntegrations) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading {label} integrations…
      </p>
    );
  }
  if (selection.integrationsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>{selection.integrationsError}</AlertDescription>
      </Alert>
    );
  }
  if (!selection.integrations) return null;
  if (selection.integrations.length === 0) {
    return (
      <Alert>
        <AlertCircle />
        <AlertDescription>No {label} integration is configured for this organization.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <SelectionField
        id="concierge-integration"
        label={`${label} Integration`}
        placeholder={`Select ${label} integration`}
        value={selection.integrationId ?? (selection.integrations.length === 1 ? selection.integrations[0]!.id : null)}
        options={selection.integrations.map((integration) => ({
          value: integration.id,
          label: integration.exportable ? integration.name : `${integration.name} — ${integration.unavailableReason}`,
          disabled: !integration.exportable,
        }))}
        disabled={exporting}
        onChange={onChange}
      />
      {unavailableReason && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>
            This {label} integration can&apos;t be exported ({unavailableReason}). Reconnect it from Integrations settings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function revoke(ref: { current: string | null }) {
  if (ref.current) URL.revokeObjectURL(ref.current);
  ref.current = null;
}
