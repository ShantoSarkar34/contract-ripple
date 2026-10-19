import type { Metadata } from "next";
import ContractsWorkspace from "@/components/contracts/contracts-workspace";

export const metadata: Metadata = {
  title: "Contracts — ContractRipple",
  description:
    "Create projects and contracts, upload baseline and candidate OpenAPI specifications, and review classified compatibility risks with JSON Pointer evidence.",
};

export default function ContractsPage() {
  return <ContractsWorkspace />;
}
