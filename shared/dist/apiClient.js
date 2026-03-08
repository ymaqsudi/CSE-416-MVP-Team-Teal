export class ApiClient {
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.apiKey = config.apiKey;
    }
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }
    async request(method, path, query) {
        const url = new URL(this.baseUrl + path);
        if (query) {
            for (const [k, v] of Object.entries(query)) {
                if (v !== undefined && v !== "")
                    url.searchParams.set(k, String(v));
            }
        }
        const headers = {
            "Accept": "application/json",
        };
        if (this.apiKey)
            headers["x-api-key"] = this.apiKey;
        const res = await fetch(url.toString(), { method, headers });
        const text = await res.text();
        const data = text ? safeJsonParse(text) : null;
        if (!res.ok) {
            const err = {
                status: res.status,
                message: (data && (data.message || data.error)) || res.statusText || "Request failed",
                details: data ?? undefined,
            };
            throw err;
        }
        return data;
    }
    // --- endpoints ---
    getPlayers(params) {
        return this.request("GET", "/players", params);
    }
    getPlayer(playerId) {
        return this.request("GET", `/players/${encodeURIComponent(playerId)}`);
    }
    getValuation(playerId) {
        return this.request("GET", `/players/${encodeURIComponent(playerId)}/valuation`);
    }
    getTransactions() {
        return this.request("GET", "/transactions");
    }
}
function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return { raw: text };
    }
}
