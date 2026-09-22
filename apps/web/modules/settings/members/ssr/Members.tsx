import { Actions } from "@/actions";

import { MembersView } from "../csr/MembersView";

export const Members = async () => {
  const [invitations, { members, currentUserId }] = await Promise.all([
    Actions.Invitations.getData(),
    Actions.Members.getData(),
  ]);
  return <MembersView invitations={invitations} members={members} currentUserId={currentUserId} />;
};
