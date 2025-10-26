// apiService.js
class ApiService {
    constructor() {
        this.pendingRequests = new Map();
        this.cache = new Map();
    }

    async request(endpoint, options = {}) {
        const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
        const now = Date.now();
        
        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached && (now - cached.timestamp) < CONFIG.APP.CACHE_DURATION) {
            return cached.data;
        }
        
        // Deduplicate simultaneous requests
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        const promise = this.makeRequest(endpoint, options);
        this.pendingRequests.set(cacheKey, promise);
        
        try {
            const result = await promise;
            
            // Cache successful responses
            this.cache.set(cacheKey, {
                data: result,
                timestamp: now
            });
            
            return result;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    async makeRequest(endpoint, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(endpoint, {
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`API Request failed: ${endpoint}`, error);
            throw error;
        }
    }

    clearCache() {
        this.cache.clear();
    }

    clearCacheForEndpoint(endpointPattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(endpointPattern)) {
                this.cache.delete(key);
            }
        }
    }

    cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
        if (now - cached.timestamp > CONFIG.APP.CACHE_DURATION) {
            this.cache.delete(key);
        }
    }
}
}