import { Actions } from "@/actions";
import { CaseDetailView } from "../csr/CaseDetailView";
import { SlaAutoRefreshProvider } from "@/components/shared/SlaAutoRefreshProvider";

export const CaseDetail = async ({ caseId }: { caseId: string }) => {
  const data = await Actions.Cases.getDetail(caseId);
  const worker = await Actions.WorkerSettings.getData();

  return (
    <>
      <CaseDetailView data={data} />
      <SlaAutoRefreshProvider
        initInterval={worker.activePollIntervalMs - 2000}
      />
    </>
  );
};
