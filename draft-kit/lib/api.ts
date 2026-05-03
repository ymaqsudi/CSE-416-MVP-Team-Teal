import { ApiClient } from "@/lib/shared/apiClient";

// new URL() requires an absolute URL when called with a single argument.
// In the browser we prepend the current origin; on the server the Route Handler
// is never called directly so this branch is unreachable in practice.
const baseUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/valuation`
    : "http://localhost:3000/api/valuation";

export const apiClient = new ApiClient({ baseUrl });
