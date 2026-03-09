import { ApiClient } from "@/lib/shared/apiClient";

const baseUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL;

if (!baseUrl) {
  // Fail fast with a clear error in development.
  throw new Error(
    "Missing NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_API_BASE_URL) env var for ApiClient. " +
      "Set it to your deployed API base URL, e.g. https://cse-416-mvp-team-teal.onrender.com"
  );
}

export const apiClient = new ApiClient({
  baseUrl,
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
});
