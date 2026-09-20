import { Actions } from "@/actions";
import { ProfileView } from "../csr/ProfileView";

export const Profile = async () => {
  const user = await Actions.Profile.getData();
  return <ProfileView user={user} />;
};
