// shared/src/apiClient.ts
import {
    ApiError,
    PlayersResponse,
    PlayerDetailResponse,
    ValuationResponse,
    TransactionsResponse,
  } from "./types";
  
  type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  
  export interface ApiClientConfig {
    baseUrl: string;               // e.g. https://your-api.onrender.com
    apiKey?: string;               // x-api-key
  }
  
  export class ApiClient {
    private baseUrl: string;
    private apiKey?: string;
  
    constructor(config: ApiClientConfig) {
      this.baseUrl = config.baseUrl.replace(/\/+$/, "");
      this.apiKey = config.apiKey;
    }
  
    setApiKey(apiKey: string) {
      this.apiKey = apiKey;
    }
  
    private async request<T>(method: HttpMethod, path: string, query?: Record<string, string | number | undefined>): Promise<T> {
      const url = new URL(this.baseUrl + path);
  
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
        }
      }
  
      const headers: Record<string, string> = {
        "Accept": "application/json",
      };
  
      if (this.apiKey) headers["x-api-key"] = this.apiKey;
  
      const res = await fetch(url.toString(), { method, headers });
  
      const text = await res.text();
      const data = text ? safeJsonParse(text) : null;
  
      if (!res.ok) {
        const err: ApiError = {
          status: res.status,
          message: (data && (data.message || data.error)) || res.statusText || "Request failed",
          details: data ?? undefined,
        };
        throw err;
      }
  
      return data as T;
    }
  
    // --- endpoints ---
    getPlayers(params?: { q?: string; position?: string; limit?: number }) {
      return this.request<PlayersResponse>("GET", "/players", params);
    }
  
    getPlayer(playerId: string) {
      return this.request<PlayerDetailResponse>("GET", `/players/${encodeURIComponent(playerId)}`);
    }
  
    getValuation(playerId: string) {
      return this.request<ValuationResponse>("GET", `/players/${encodeURIComponent(playerId)}/valuation`);
    }
  
    getTransactions() {
      return this.request<TransactionsResponse>("GET", "/transactions");
    }
  }
  
  function safeJsonParse(text: string) {
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }
  