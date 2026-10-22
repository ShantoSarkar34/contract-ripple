import type { Metadata } from "next";
import ContractDetail from "@/components/contracts/contract-detail";

export const metadata: Metadata = {
  title: "Contract — ContractRipple",
  description:
    "Review an OpenAPI contract's immutable version history and the saved analyses that reference it.",
};

export default async function ContractPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  return <ContractDetail contractId={contractId} />;
}
