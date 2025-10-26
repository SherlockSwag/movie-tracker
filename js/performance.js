// performance.js
class PerformanceOptimizer {
    constructor() {
        this.debounceTimers = new Map();
        this.throttleFlags = new Map();
    }

    debounce(key, fn, delay = CONFIG.APP.DEBOUNCE_DELAY) {
        clearTimeout(this.debounceTimers.get(key));
        this.debounceTimers.set(key, setTimeout(fn, delay));
    }

    throttle(key, fn, limit = 100) {
        if (!this.throttleFlags.get(key)) {
            fn();
            this.throttleFlags.set(key, true);
            setTimeout(() => this.throttleFlags.set(key, false), limit);
        }
    }

    // Cache expensive operations
    memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
        const cache = new Map();
        return (...args) => {
            const key = keyFn(...args);
            if (cache.has(key)) {
                return cache.get(key);
            }
            const result = fn(...args);
            cache.set(key, result);
            return result;
        };
    }

    // Batch DOM updates
    batchDOMUpdates(callback) {
        // Simple implementation - just execute the callback
        callback();
    }
}