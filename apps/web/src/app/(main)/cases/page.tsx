import { CaseList } from "@modules/cases/case-list";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Cases",
};
export default function CasesPage() {
  return <CaseList />;
}
