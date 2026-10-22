import { Suspense } from "react";
import WorkspaceShell from "@/components/workspace/workspace-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden="true" />}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}
