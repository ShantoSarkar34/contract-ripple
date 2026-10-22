import type { Metadata } from "next";
import ProjectDetail from "@/components/projects/project-detail";

export const metadata: Metadata = {
  title: "Project — ContractRipple",
  description:
    "Review a project's contracts, versions, and saved OpenAPI comparison analyses.",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectDetail projectId={projectId} />;
}
