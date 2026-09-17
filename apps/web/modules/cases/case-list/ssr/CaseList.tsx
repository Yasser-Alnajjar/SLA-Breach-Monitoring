import { Actions } from "@/actions";

import { CaseListView } from "../csr/CaseListView";
import { SlaAutoRefreshProvider } from "@/components/shared/SlaAutoRefreshProvider";

export const CaseList = async () => {
  const data = await Actions.Cases.getList();
  const worker = await Actions.WorkerSettings.getData();

  return (
    <>
      <CaseListView data={data} />
      <SlaAutoRefreshProvider
        initInterval={worker.activePollIntervalMs - 2000}
      />
    </>
  );
};
