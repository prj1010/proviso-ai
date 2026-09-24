import { ok, fail, type ApiResponse } from "@/lib/api-envelope";
import { ask, chatPage, getAgreement, listAgreements, readQuery, reprocess } from "@/clause/local-db";

export interface AgreementSummaryItem {
  id: string;
  type: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetUserAgreementsResponse {
  agreements: AgreementSummaryItem[];
}

export interface AgreementDetailsResponse {
  chatId: string;
  agreement: any;
  risks: unknown[];
}

export interface ProcessAgreementResponse {
  message: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface SendAgreementQueryResponse {
  queryId: string;
  userMessage: ChatMessage;
  message?: ChatMessage;
}

export interface GetQueryResultResponse {
  status: "SUCCESS" | "PROCESSING" | "FAILED";
  message?: ChatMessage;
  error?: string;
}

export interface GetChatMessagesResponse {
  messages: ChatMessage[];
  nextCursor: string | null;
}

export const getUserAgreements = async (): Promise<ApiResponse<GetUserAgreementsResponse>> => {
  return ok({ agreements: listAgreements() });
};

export const getAgreementDetails = async (
  id: string,
): Promise<ApiResponse<AgreementDetailsResponse>> => {
  const agreement = getAgreement(id);
  if (!agreement) return fail("Agreement not found", 404);
  return ok({
    chatId: agreement.chatId,
    agreement,
    risks: agreement.risks,
  });
};

export const processAgreement = async (
  id: string,
): Promise<ApiResponse<ProcessAgreementResponse>> => {
  await reprocess(id);
  return ok({ message: "Re-ran the review." });
};

export const sendAgreementQuery = async (params: {
  agreementId: string;
  message: string;
  chatId: string;
}): Promise<ApiResponse<SendAgreementQueryResponse>> => {
  try {
    const result = await ask(params.agreementId, params.message);
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not answer.");
  }
};

export const getQueryResult = async (
  queryId: string,
): Promise<ApiResponse<GetQueryResultResponse>> => {
  const message = readQuery(queryId);
  if (!message) return ok({ status: "PROCESSING" });
  return ok({ status: "SUCCESS", message });
};

export const getChatMessages = async (params: {
  chatId: string;
  agreementId: string;
  limit?: number;
  cursor?: string;
}): Promise<ApiResponse<GetChatMessagesResponse>> => {
  if (params.cursor) return ok({ messages: [], nextCursor: null });
  return ok({ messages: chatPage(params.chatId), nextCursor: null });
};
