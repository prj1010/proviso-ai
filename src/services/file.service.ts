import { extractDocumentText, mimeForFile } from "@/clause/extract";
import { deleteFile, ingestExtracted, listFiles } from "@/clause/local-db";
import { ok, fail, type ApiResponse } from "@/lib/api-envelope";

export interface FileUploadUrlResponse {
  fileId: string;
  uploadUrl: string;
}

export interface FileDownloadUrlResponse {
  fileId: string;
  downloadUrl: string;
}

export interface ProcessFileResponse {
  success: boolean;
}

export interface UserFileItem {
  id: string;
  fileName?: string;
  mimeType?: string;
  status: string;
  createdAt?: string;
}

export interface GetUserFilesResponse {
  files: UserFileItem[];
}

export const getFileUploadUrl = async (
  _fileName: string,
  _mimeType: string,
): Promise<ApiResponse<FileUploadUrlResponse>> => {
  return fail("Use the local reader instead of a presigned upload.");
};

export const getFileDownloadUrl = async (
  fileId: string,
): Promise<ApiResponse<FileDownloadUrlResponse>> => {
  return ok({ fileId, downloadUrl: "" });
};

export const processFile = async (
  _fileId: string,
): Promise<ApiResponse<ProcessFileResponse>> => {
  return ok({ success: true });
};

export const removeFile = async (fileId: string): Promise<ApiResponse<{ removed: boolean }>> => {
  const removed = await deleteFile(fileId);
  if (!removed) return fail("File not found", 404);
  return ok({ removed: true });
};

export const getUserFiles = async (): Promise<ApiResponse<GetUserFilesResponse>> => {
  return ok({ files: listFiles() });
};

export const ingestPdfFile = async (
  file: File,
): Promise<ApiResponse<{ agreementId: string; title: string; status: string }>> => {
  try {
    const text = await extractDocumentText(file);
    const agreement = await ingestExtracted(file.name, text, mimeForFile(file));
    return ok({
      agreementId: agreement.id,
      title: agreement.title,
      status: agreement.status,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not read that file.");
  }
};
