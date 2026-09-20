import { Actions } from "@/actions";

import { SlaConfigurationView } from "../csr/SlaConfigurationView";
import { getPrismaClient } from "@sla/db";

/**
 * `AppShell` is itself an async server component (it reads the session
 * directly for the user menu), so it's composed here rather than inside the
 * "use client" view — nesting it in the CSR layer would drag `@sla/db` into
 * the browser bundle.
 */
export const SlaConfiguration = async () => {
  const data = await Actions.SlaConfiguration.getData();
  const prisma = getPrismaClient();

  const policyVersions = await prisma.sLAPolicyVersion.findMany({
    where: {
      policy: {
        name: "D6 - High Priority Policy",
      },
    },
    select: {
      id: true,
      version: true,
      match: true,
      targets: true,
      effectiveFrom: true,
      policy: {
        select: {
          name: true,
          position: true,
        },
      },
    },
  });

  console.dir(policyVersions, { depth: null });
  console.log(data);

  return <SlaConfigurationView data={data} />;
};
