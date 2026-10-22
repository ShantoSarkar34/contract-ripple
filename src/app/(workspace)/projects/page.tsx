import type { Metadata } from "next";
import ProjectsView from "@/components/projects/projects-view";

export const metadata: Metadata = {
  title: "Projects — ContractRipple",
  description:
    "Create projects, group OpenAPI contracts and their versions, and open the analyses saved against them.",
};

export default function ProjectsPage() {
  return <ProjectsView />;
}
