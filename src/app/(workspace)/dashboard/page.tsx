import type { Metadata } from "next";
import DashboardView from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard — ContractRipple",
  description: "An overview of your projects, contracts, and saved analyses.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
