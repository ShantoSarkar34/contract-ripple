import type { Metadata } from "next";
import ContractsWorkspace from "@/components/contracts/contracts-workspace";

export const metadata: Metadata = {
  title: "Contracts — ContractRipple",
  description:
    "Compare OpenAPI specifications, review classified compatibility risks with JSON Pointer evidence, analyze source impact, export reports, and generate regression checks.",
};

export default function ContractsPage() {
  return <ContractsWorkspace />;
}
