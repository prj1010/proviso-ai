import { UserProfile } from "@/services/user.service";
import { Link, useRouterState } from "@tanstack/react-router";
import React from "react";
import BrandLogo from "./BrandLogo";
import { IconClose, IconDocument, IconFolder, IconHome, IconLogOut } from "./icons/CustomIcons";

interface SidebarProps {
  user?: UserProfile | null;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const itemStyle = {
    justifyContent: "flex-start",
    width: "100%",
    fontSize: "0.875rem",
    padding: "10px 14px",
    textDecoration: "none",
    borderRadius: "12px",
  } as const;

  const sidebarContent = (
    <aside
      style={{
        width: "260px",
        background: "#FAFAFC",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100vh",
        position: "sticky",
        top: 0,
        padding: "24px 18px",
        zIndex: 50,
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
            padding: "0 6px",
          }}
        >
          <Link to="/" onClick={onCloseMobile} style={{ textDecoration: "none" }}>
            <BrandLogo size="md" />
          </Link>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="btn btn-ghost btn-sm mobile-show-flex"
              style={{ display: "none", padding: "6px" }}
              aria-label="Close sidebar"
              type="button"
            >
              <IconClose size={16} />
            </button>
          )}
        </div>

        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#94A3B8",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "0 10px 12px 10px",
          }}
        >
          Workspace
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <Link
            to="/dashboard/agreements"
            onClick={onCloseMobile}
            className={`btn ${pathname.startsWith("/dashboard/agreements") ? "btn-primary" : "btn-ghost"}`}
            style={itemStyle}
          >
            <IconDocument size={16} />
            <span>Agreements</span>
          </Link>
          <Link
            to="/dashboard/files"
            onClick={onCloseMobile}
            className={`btn ${pathname.startsWith("/dashboard/files") ? "btn-primary" : "btn-ghost"}`}
            style={itemStyle}
          >
            <IconFolder size={16} />
            <span>Files History</span>
          </Link>
        </nav>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <Link
            to="/"
            onClick={onCloseMobile}
            className="btn btn-ghost btn-sm"
            title="Go to Homepage"
            style={{ fontSize: "0.8rem", textDecoration: "none", padding: "6px 10px" }}
          >
            <IconHome size={15} /> Homepage
          </Link>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid var(--border-medium)",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A" }}>Logout</div>
          <button
            onClick={() => {
              onCloseMobile?.();
              onLogout();
            }}
            className="btn btn-ghost btn-sm"
            title="Sign Out"
            style={{ padding: "6px", color: "#94A3B8" }}
            aria-label="Sign out"
            type="button"
          >
            <IconLogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="mobile-hide">{sidebarContent}</div>
      {isMobileOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--bg-modal-overlay)",
            backdropFilter: "blur(4px)",
            zIndex: 90,
            display: "flex",
          }}
          onClick={onCloseMobile}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "280px", height: "100%", animation: "fadeInModal 0.2s ease-out" }}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
