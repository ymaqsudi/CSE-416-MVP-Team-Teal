import { ApiClient } from "@/lib/shared/apiClient";

export const apiClient = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL!,
  apiKey: process.env.NEXT_PUBLIC_API_KEY!,
});
