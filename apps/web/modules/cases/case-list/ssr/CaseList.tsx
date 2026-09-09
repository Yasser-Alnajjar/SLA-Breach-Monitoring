import { Actions } from "@/actions";
import { AppShell } from "@/components/layout/app-shell";
import { CaseListView } from "../csr/CaseListView";

export const CaseList = async () => {
  const data = await Actions.Cases.getList();
  return (
    <AppShell title="All cases">
      <CaseListView data={data} />
    </AppShell>
  );
};
