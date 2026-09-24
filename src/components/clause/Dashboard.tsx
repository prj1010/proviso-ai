import { DashboardProvider, type DashboardOutletContext } from "@/clause/dashboard-context";
import { getAuthToken } from "@/lib/auth.util";
import { agreementService, fileService } from "@/services";
import type { AgreementSummaryItem } from "@/services/agreement.service";
import type { UserFileItem } from "@/services/file.service";
import type { UserProfile } from "@/services/user.service";
import { Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import BrandLogo from "@/components/clause/BrandLogo";
import FileUploadModal from "@/components/clause/FileUploadModal";
import { IconMenu } from "@/components/clause/icons/CustomIcons";
import Sidebar from "@/components/clause/Sidebar";

interface DashboardProps {
  user: UserProfile | null;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [files, setFiles] = useState<UserFileItem[]>([]);
  const [agreements, setAgreements] = useState<AgreementSummaryItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingAgreements, setLoadingAgreements] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!getAuthToken()) return;
    setLoadingFiles(true);
    const res = await fileService.getUserFiles();
    setLoadingFiles(false);
    if (res.success && res.data) setFiles(res.data.files || []);
  }, []);

  const fetchAgreements = useCallback(async () => {
    if (!getAuthToken()) return;
    setLoadingAgreements(true);
    const res = await agreementService.getUserAgreements();
    setLoadingAgreements(false);
    if (res.success && res.data) setAgreements(res.data.agreements || []);
  }, []);

  useEffect(() => {
    void fetchFiles();
    void fetchAgreements();
    const onDb = () => {
      void fetchFiles();
      void fetchAgreements();
    };
    window.addEventListener("clause:db", onDb);
    return () => window.removeEventListener("clause:db", onDb);
  }, [fetchFiles, fetchAgreements]);

  const outlet: DashboardOutletContext = {
    user,
    agreements,
    files,
    loadingAgreements,
    loadingFiles,
    refreshAgreements: () => void fetchAgreements(),
    refreshFiles: () => void fetchFiles(),
    openUpload: () => setIsUploadModalOpen(true),
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FFFFFF" }}>
      <Sidebar
        user={user}
        onLogout={onLogout}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "#FFFFFF",
        }}
      >
        <div
          className="mobile-show-flex"
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            background: "#FFFFFF",
            borderBottom: "1px solid var(--border-subtle)",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open Navigation Menu"
            style={{ padding: "6px 10px" }}
            type="button"
          >
            <IconMenu size={18} />
          </button>
          <BrandLogo size="sm" />
          <div style={{ width: "32px" }} />
        </div>

        <main
          className="dashboard-main-content"
          style={{
            flex: 1,
            padding: "36px 44px",
            overflowY: "auto",
            maxWidth: "1400px",
            width: "100%",
            margin: "0 auto",
            background: "#FFFFFF",
          }}
        >
          <DashboardProvider value={outlet}>
            <Outlet />
          </DashboardProvider>
        </main>
      </div>

      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={() => {
          void fetchFiles();
          void fetchAgreements();
        }}
      />
    </div>
  );
}
