import FilesView from "@/components/clause/FilesView";
import { useDashboard } from "@/clause/dashboard-context";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/files")({
  component: FilesPage,
});

function FilesPage() {
  const ctx = useDashboard();
  return (
    <FilesView
      files={ctx.files}
      loading={ctx.loadingFiles}
      onRefresh={ctx.refreshFiles}
      onOpenUploadModal={ctx.openUpload}
    />
  );
}
