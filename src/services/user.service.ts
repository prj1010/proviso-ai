import { ok, fail, type ApiResponse } from "@/lib/api-envelope";
import { getAuthToken, readStoredUser } from "@/lib/auth.util";

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetProfileResponse {
  user: UserProfile;
}

export const getProfile = async (): Promise<ApiResponse<GetProfileResponse>> => {
  if (!getAuthToken()) return fail("Not signed in", 401);
  const user = readStoredUser();
  if (!user) return fail("Not signed in", 401);
  return ok({ user });
};
