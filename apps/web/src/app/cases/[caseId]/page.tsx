import { CaseDetail } from "@modules/cases/case-detail";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <CaseDetail caseId={caseId} />;
}
