import { Actions } from "@/actions";

import { MembersView } from "../csr/MembersView";

export const Members = async () => {
  const invitations = await Actions.Invitations.getData();
  return <MembersView invitations={invitations} />;
};
