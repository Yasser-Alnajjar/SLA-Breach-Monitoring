import type { NextRequest } from "next/server";
import { listIntegrationsResponse } from "@/lib/concierge-route";

export async function GET(request: NextRequest) {
  return listIntegrationsResponse(request, "jira");
}
