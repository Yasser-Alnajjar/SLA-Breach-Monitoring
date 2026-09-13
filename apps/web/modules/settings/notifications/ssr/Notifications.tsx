import { Actions } from "@/actions";

import { NotificationsView } from "../csr/NotificationsView";

export const Notifications = async () => {
  const data = await Actions.Notifications.getData();

  return <NotificationsView data={data} />;
};
