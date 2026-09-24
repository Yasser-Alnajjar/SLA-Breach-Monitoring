"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import type { CaseDetailData } from "@/lib/types/cases";

import { ActivityTimeline } from "./ActivityTimeline";
import { CaseHeader } from "./CaseHeader";
import { CaseJourney } from "./CaseJourney";
import { CommitmentSummary } from "./CommitmentSummary";
import { LinkedRecords } from "./LinkedRecords";
import { ConversationThread } from "./ConversationThread";
import { CalculationLedger } from "./CalculationLedger";

/**
 * Keeps the URL's `commitmentId` pointed at the case's active Next Reply
 * cycle when the server-side poll advances it.
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
  selectedCommitmentId: string | null;
}

export const CaseDetailView = ({
  data,
  selectedCommitmentId,
}: CaseDetailViewProps) => {
  useNextReplyCycleSync(data.commitments, selectedCommitmentId);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* ── Sub-header breadcrumb + case identity banner ── */}
      <CaseHeader data={data} />

      {/* ── Dual commitment cards ── */}
      <CommitmentSummary
        data={data}
        selectedCommitmentId={selectedCommitmentId}
      />

      {/* ── Segmented Case Journey ── */}
      <CaseJourney data={data} />

      {/* ── High-density two-column core: exact Stitch 7/5 composition ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-7">
          <CalculationLedger
            data={data}
            selectedCommitmentId={selectedCommitmentId}
          />
          <LinkedRecords data={data} />
        </div>

        <div className="flex flex-col gap-6 xl:col-span-5">
          <ActivityTimeline data={data} />
        </div>
      </div>

      <ConversationThread data={data} />
    </div>
  );
};
