"use client";

import { AuthGate } from "@/components/workspace/auth-gate";
import ContractsWorkspace from "./contracts-workspace";

export default function ContractsGate({
  initialProjectId,
  initialContractId,
}: {
  initialProjectId?: string;
  initialContractId?: string;
}) {
  return (
    <AuthGate
      signInTitle="Sign in to use the workspace"
      signInDescription={
        <p>
          Projects, contract versions, comparisons, source analysis, and report downloads are
          private to the account that created them.
        </p>
      }
    >
      <ContractsWorkspace
        initialProjectId={initialProjectId}
        initialContractId={initialContractId}
      />
    </AuthGate>
  );
}
