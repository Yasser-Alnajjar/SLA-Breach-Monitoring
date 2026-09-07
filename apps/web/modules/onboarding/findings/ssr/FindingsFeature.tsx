import { Actions } from "@/actions";
import { FindingsView } from "../csr/FindingsView";

export const FindingsFeature = async () => {
  const data = await Actions.Findings.getData();
  return <FindingsView data={data} />;
};
