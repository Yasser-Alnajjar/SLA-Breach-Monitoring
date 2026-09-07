import { Actions } from "@/actions";
import { CaseDetailView } from "../csr/CaseDetailView";

export const CaseDetailFeature = async ({ caseId }: { caseId: string }) => {
  const data = await Actions.Cases.getDetail(caseId);
  return <CaseDetailView data={data} />;
};
