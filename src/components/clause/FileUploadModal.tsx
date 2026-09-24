import { fileService } from "@/services";
import { isSupportedDocument } from "@/clause/extract";
import React, { useRef, useState } from "react";
import {
    IconAlertTriangle,
    IconCheck,
    IconClose,
    IconFilePdf,
    IconUploadCloud,
    InlineSpinner,
} from "./icons/CustomIcons";

interface FileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadComplete: () => void;
}

type JobStatus = "queued" | "reading" | "done" | "failed";

interface UploadJob {
    id: string;
    file: File;
    status: JobStatus;
    detail: string;
}

const READ_AT_ONCE = 2;

function isPdf(file: File) {
    return isSupportedDocument(file);
}

function jobId() {
    return crypto.randomUUID?.() ?? `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
    isOpen,
    onClose,
    onUploadComplete,
}) => {
    const [jobs, setJobs] = useState<UploadJob[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const addFiles = (list: FileList | File[]) => {
        const incoming = Array.from(list);
        const pdfs = incoming.filter(isPdf);
        const skipped = incoming.length - pdfs.length;
        if (!pdfs.length) {
            setError("Use a PDF, Word document (.doc or .docx), or a text file.");
            return;
        }
        setError(skipped ? `${skipped} file${skipped === 1 ? "" : "s"} skipped. Use PDF, Word, or text.` : null);
        setJobs((prev) => [
            ...prev,
            ...pdfs.map((file) => ({
                id: jobId(),
                file,
                status: "queued" as const,
                detail: "Waiting. This lease is separate from the others.",
            })),
        ]);
    };

    const patchJob = (id: string, partial: Partial<UploadJob>) => {
        setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...partial } : job)));
    };

    const handleStartUpload = async () => {
        const pending = jobs.filter((job) => job.status === "queued" || job.status === "failed");
        if (!pending.length) return;
        setUploading(true);
        setError(null);
        let cursor = 0;
        const worker = async () => {
            while (cursor < pending.length) {
                const job = pending[cursor];
                cursor += 1;
                patchJob(job.id, { status: "reading", detail: "Reading this file on its own." });
                const res = await fileService.ingestPdfFile(job.file);
                if (!res.success) {
                    patchJob(job.id, {
                        status: "failed",
                        detail: res.error || "Could not read this file.",
                    });
                    continue;
                }
                patchJob(job.id, {
                    status: "done",
                    detail:
                        res.data?.status === "FAILED"
                            ? "Saved, but this file had no readable text."
                            : `Saved as its own ${res.data?.title || "lease"}.`,
                });
            }
        };
        await Promise.all(
            Array.from({ length: Math.min(READ_AT_ONCE, pending.length) }, () => worker()),
        );
        setUploading(false);
        onUploadComplete();
    };

    const handleClose = () => {
        if (uploading) return;
        setJobs([]);
        setError(null);
        onClose();
    };

    const ready = jobs.some((job) => job.status === "queued" || job.status === "failed");

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "560px", width: "100%" }}
            >
                <p
                    style={{
                        fontSize: "0.88rem",
                        color: "#64748B",
                        marginBottom: "20px",
                        lineHeight: 1.5,
                    }}
                >
                    Upload house, office, and shop leases together. PDF, Word, and text files are each
                    read on their own and saved as their own agreement.
                </p>

                {error && (
                    <div
                        style={{
                            padding: "10px 14px",
                            borderRadius: "8px",
                            background: "var(--pastel-red-bg)",
                            border: "1px solid var(--pastel-red-border)",
                            color: "var(--pastel-red-text)",
                            fontSize: "0.82rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "18px",
                        }}
                    >
                        <IconAlertTriangle size={15} />
                        <span>{error}</span>
                    </div>
                )}

                <div
                    className="dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (!uploading && e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                    }}
                    onClick={() => {
                        if (!uploading) fileInputRef.current?.click();
                    }}
                    style={{ marginBottom: jobs.length ? "16px" : undefined, opacity: uploading ? 0.6 : 1 }}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.md,.rtf,.csv,application/pdf,application/msword,text/plain"
                        multiple
                        style={{ display: "none" }}
                        onChange={(e) => {
                            if (e.target.files?.length) addFiles(e.target.files);
                            e.target.value = "";
                        }}
                    />
                    <div
                        style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "14px",
                            background: "#0F172A",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 14px auto",
                            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.15)",
                        }}
                    >
                        <IconFilePdf size={24} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#0F172A", marginBottom: "4px" }}>
                        Click to upload or drag & drop
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#94A3B8" }}>
                        One or more files, up to 25MB each. PDF, Word, or text.
                    </div>
                </div>

                {jobs.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
                        {jobs.map((job) => (
                            <div
                                key={job.id}
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "12px",
                                    background: "#F8FAFC",
                                    border: "1px solid var(--border-medium)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" }}>
                                    <div style={{ flexShrink: 0, color: job.status === "failed" ? "#DC2626" : "#0F172A" }}>
                                        {job.status === "reading" ? (
                                            <InlineSpinner size={16} />
                                        ) : job.status === "done" ? (
                                            <IconCheck size={16} />
                                        ) : job.status === "failed" ? (
                                            <IconAlertTriangle size={16} />
                                        ) : (
                                            <IconFilePdf size={16} />
                                        )}
                                    </div>
                                    <div style={{ overflow: "hidden" }}>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                fontSize: "0.86rem",
                                                color: "#0F172A",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                            title={job.file.name}
                                        >
                                            {job.file.name}
                                        </div>
                                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{job.detail}</div>
                                    </div>
                                </div>
                                {!uploading && job.status !== "done" && (
                                    <button
                                        onClick={() => setJobs((prev) => prev.filter((item) => item.id !== job.id))}
                                        className="btn btn-ghost btn-sm"
                                        aria-label={`Remove ${job.file.name}`}
                                        style={{ padding: "4px", color: "#94A3B8" }}
                                        type="button"
                                    >
                                        <IconClose size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleClose} disabled={uploading}>
                        {jobs.some((job) => job.status === "done") && !uploading ? "Done" : "Cancel"}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void handleStartUpload()}
                        disabled={!ready || uploading}
                    >
                        {uploading ? (
                            <>
                                <InlineSpinner size={14} />
                                <span>Reading separately...</span>
                            </>
                        ) : (
                            <>
                                <IconUploadCloud size={14} />
                                <span>{jobs.length > 1 ? `Review ${jobs.filter((j) => j.status !== "done").length} leases` : "Upload Document"}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FileUploadModal;
