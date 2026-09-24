import { fail, ok, type ApiResponse } from "@/lib/api-envelope";
import { setAuthToken, writeStoredUser } from "@/lib/auth.util";

export interface RequestOtpResponse {
  message: string;
  expiryInMins: number;
}

export interface VerifyOtpResponse {
  message: string;
  enableOnboarding: boolean;
}

const PENDING = "clause-pending-email";
export const LOCAL_OTP = "482910";

export const requestOtp = async (email: string): Promise<ApiResponse<RequestOtpResponse>> => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("Enter a valid email address.");
  }
  if (typeof window !== "undefined") sessionStorage.setItem(PENDING, email);
  return ok({
    message: `Local session — your code is ${LOCAL_OTP}. The mail queue was removed, so nothing is sent.`,
    expiryInMins: 10,
  });
};

export const verifyOtp = async (
  email: string,
  otp: string,
): Promise<ApiResponse<VerifyOtpResponse>> => {
  const pending = typeof window !== "undefined" ? sessionStorage.getItem(PENDING) : email;
  if (pending && pending !== email) return fail("Start again with the same email.");
  if (otp.trim() !== LOCAL_OTP) {
    return fail(`That code does not match. Use ${LOCAL_OTP}.`);
  }
  const user = {
    id: "local-counsel",
    email,
    name: email.split("@")[0],
    createdAt: new Date().toISOString(),
  };
  setAuthToken("local." + user.email);
  writeStoredUser(user);
  if (typeof window !== "undefined") sessionStorage.removeItem(PENDING);
  return ok({ message: "Workspace ready.", enableOnboarding: false });
};

export const logout = async (): Promise<ApiResponse<{ message: string }>> => {
  return ok({ message: "Signed out." });
};
