import { AtRiskRowData } from "@/lib/types/at-risk";
import React from "react";
import { AtRiskList } from "./AtRiskList";

export const AtRiskView = ({ data }: { data: AtRiskRowData[] }) => {
  return <AtRiskList data={data} />;
};
