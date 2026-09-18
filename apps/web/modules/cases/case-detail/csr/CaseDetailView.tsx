"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import type { CaseDetailData } from "@/lib/types/cases";

import { ActivityTimeline } from "./ActivityTimeline";
import { CaseHeader } from "./CaseHeader";
import { CaseJourney } from "./CaseJourney";
import { CommitmentSummary } from "./CommitmentSummary";
import { ConversationThread } from "./ConversationThread";
import { LinkedRecords } from "./LinkedRecords";

/**
 * Keeps the URL's `commitmentId` pointed at the case's active Next Reply
 * cycle (roadmap: Next Reply auto-advance). The page polls via
 * `SlaAutoRefreshProvider`, which re-fetches `data` for the same URL, so a
 * Next Reply cycle that gets superseded (its commitment resolves and a new
 * cycle starts) leaves the currently selected commitment stale. When that
 * happens, replace the URL's `commitmentId` with the cycle that is actually
 * on track — the existing SSR flow then re-renders around it.
 *
 * A selection that isn't a Next Reply commitment (e.g. First Response, or a
 * "Breached cases" link into a superseded cycle) never auto-advances.
 */
function useNextReplyCycleSync(
  commitments: CaseDetailData["commitments"],
  selectedCommitmentId: string | null,
): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = commitments.find((c) => c.id === selectedCommitmentId);
  const activeNextReply = commitments.find(
    (c) => c.kind === "next_reply" && c.status === "on_track",
  );

  const staleCommitmentId =
    selected?.kind === "next_reply" &&
    activeNextReply !== undefined &&
    activeNextReply.id !== selectedCommitmentId
      ? activeNextReply.id
      : null;

  useEffect(() => {
    if (!staleCommitmentId) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("commitmentId", staleCommitmentId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [staleCommitmentId, pathname, router, searchParams]);
}

interface CaseDetailViewProps {
  data: CaseDetailData;
  /** A commitment of this case to highlight (validated by the SSR layer), or null. */
  selectedCommitmentId: string | null;
}

export const CaseDetailView = ({
  data,
  selectedCommitmentId,
}: CaseDetailViewProps) => {
  useNextReplyCycleSync(data.commitments, selectedCommitmentId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to dashboard
      </Link>

      <CaseHeader data={data} />

      <div className="mt-6">
        <CommitmentSummary
          data={data}
          selectedCommitmentId={selectedCommitmentId}
        />
      </div>

      <div className="mt-4">
        <CaseJourney data={data} />
      </div>

      <div className="mt-4">
        <ConversationThread data={data} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ActivityTimeline data={data} />
        <LinkedRecords data={data} />
      </div>
    </main>
  );
};
