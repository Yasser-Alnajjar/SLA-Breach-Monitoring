import { Actions } from "@/actions";
import { MonitoringView } from "../csr/MonitoringView";

export const Monitoring = async () => {
  const data = await Actions.WorkerSettings.getData();

  return <MonitoringView data={data} />;
};
