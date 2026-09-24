export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
  status?: number;
}

export function ok<T>(data: T, status = 200): ApiResponse<T> {
  return { success: true, data, error: null, status };
}

export function fail<T = null>(error: string, status = 400): ApiResponse<T> {
  return { success: false, data: null, error, status };
}
