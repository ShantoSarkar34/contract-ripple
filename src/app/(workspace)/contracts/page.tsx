import type { Metadata } from "next";
import ContractsGate from "@/components/contracts/contracts-gate";

export const metadata: Metadata = {
  title: "Contracts — ContractRipple",
  description:
    "Compare OpenAPI specifications, review classified compatibility risks with JSON Pointer evidence, analyze source impact, export reports, and generate regression checks.",
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[]; contract?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <ContractsGate
      initialProjectId={typeof params.project === "string" ? params.project : undefined}
      initialContractId={typeof params.contract === "string" ? params.contract : undefined}
    />
  );
}
