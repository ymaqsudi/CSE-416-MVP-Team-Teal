import { PlayersResponse, PlayerDetailResponse, ValuationResponse, TransactionsResponse } from "./types";
export interface ApiClientConfig {
    baseUrl: string;
    apiKey?: string;
}
export declare class ApiClient {
    private baseUrl;
    private apiKey?;
    constructor(config: ApiClientConfig);
    setApiKey(apiKey: string): void;
    private request;
    getPlayers(params?: {
        q?: string;
        position?: string;
        limit?: number;
    }): Promise<PlayersResponse>;
    getPlayer(playerId: string): Promise<PlayerDetailResponse>;
    getValuation(playerId: string): Promise<ValuationResponse>;
    getTransactions(): Promise<TransactionsResponse>;
}
//# sourceMappingURL=apiClient.d.ts.map