import {
  GetPlayersParams,
  PlayersResponse,
  ValuationResponse,
  ApiError,
  Player,
} from "./types";

export class TealCoreClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err: ApiError = await res.json();
      throw new Error(`[${err.statusCode}] ${err.error}: ${err.message}`);
    }

    return res.json() as Promise<T>;
  }

  async getPlayers(params?: GetPlayersParams): Promise<PlayersResponse> {
    const query = new URLSearchParams();
    if (params?.q)        query.set("q", params.q);
    if (params?.position) query.set("position", params.position);
    if (params?.limit)    query.set("limit", String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<PlayersResponse>(`/players${qs}`);
  }

  async getPlayer(playerId: string): Promise<Player> {
    return this.request<Player>(`/players/${playerId}`);
  }

  async getValuation(playerId: string): Promise<ValuationResponse> {
    return this.request<ValuationResponse>(`/players/${playerId}/valuation`);
  }
}
