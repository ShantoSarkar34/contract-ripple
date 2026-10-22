import type { Metadata } from "next";
import HistoryView from "@/components/history/history-view";

export const metadata: Metadata = {
  title: "History — ContractRipple",
  description:
    "Browse saved OpenAPI comparison analyses across every project and open their findings and evidence.",
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialProjectId = typeof params.project === "string" ? params.project : "";
  return <HistoryView initialProjectId={initialProjectId} />;
}
