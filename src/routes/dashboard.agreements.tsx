import AgreementsView from "@/components/clause/AgreementsView";
import { useDashboard } from "@/clause/dashboard-context";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/agreements")({
  component: AgreementsPage,
});

function AgreementsPage() {
  const ctx = useDashboard();
  return (
    <AgreementsView
      agreements={ctx.agreements}
      loading={ctx.loadingAgreements}
      onRefresh={ctx.refreshAgreements}
      onOpenUploadModal={ctx.openUpload}
      user={ctx.user}
    />
  );
}
