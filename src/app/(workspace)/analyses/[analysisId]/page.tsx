import type { Metadata } from "next";
import AnalysisDetail from "@/components/analyses/analysis-detail";

export const metadata: Metadata = {
  title: "Analysis — ContractRipple",
  description:
    "Review a saved OpenAPI comparison: findings, JSON Pointer evidence, source impact, reports, and regression checks.",
};

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const { analysisId } = await params;
  return <AnalysisDetail analysisId={analysisId} />;
}
