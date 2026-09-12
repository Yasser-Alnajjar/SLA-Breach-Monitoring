import { Actions } from "@/actions";

import { CaseListView } from "../csr/CaseListView";

export const CaseList = async () => {
  const data = await Actions.Cases.getList();
  return <CaseListView data={data} />;
};
