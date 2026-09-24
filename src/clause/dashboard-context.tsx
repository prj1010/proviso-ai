import type { AgreementSummaryItem } from "@/services/agreement.service";
import type { UserFileItem } from "@/services/file.service";
import type { UserProfile } from "@/services/user.service";
import { createContext, useContext, type ReactNode } from "react";

export interface DashboardOutletContext {
  user: UserProfile | null;
  agreements: AgreementSummaryItem[];
  files: UserFileItem[];
  loadingAgreements: boolean;
  loadingFiles: boolean;
  refreshAgreements: () => void;
  refreshFiles: () => void;
  openUpload: () => void;
}

const DashboardContext = createContext<DashboardOutletContext | null>(null);

export function DashboardProvider({
  value,
  children,
}: {
  value: DashboardOutletContext;
  children: ReactNode;
}) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("Dashboard context is missing");
  return value;
}
