import { Actions } from "@/actions";
import { OrganizationView } from "../csr/OrganizationView";

export const Organization = async () => {
  const data = await Actions.Organization.getData();

  return <OrganizationView data={data} />;
};
