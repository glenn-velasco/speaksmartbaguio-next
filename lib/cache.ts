interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs = 300_000) {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Update cached item or add new one
   * Useful for keeping cache fresh after mutations
   */
  update<T>(key: string, data: T, ttlMs: number): void {
    this.set(key, data, ttlMs);
  }

  /**
   * Get all cached keys matching a pattern
   */
  getKeys(pattern: string): string[] {
    const keys: string[] = [];
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Update item in cache by ID within collection caches
   * This updates the item in all cached list responses
   */
  updateItemInCollection<T extends { id: string }>(
    collection: string,
    itemId: string,
    updatedItem: T
  ): void {
    const pattern = `/api/v1/${collection}`;
    const keys = this.getKeys(pattern);

    for (const key of keys) {
      const cached = this.get<{ data: unknown[] }>(key);
      if (cached && Array.isArray(cached.data)) {
        const itemIndex = cached.data.findIndex((item: any) => item.id === itemId);
        if (itemIndex !== -1) {
          cached.data[itemIndex] = updatedItem;
          // Refresh the cache entry
          this.set(key, cached, DEFAULT_CACHE_TTL);
        }
      }
    }
  }

  /**
   * Remove item from all collection caches
   */
  removeItemFromCollection(collection: string, itemId: string): void {
    const pattern = `/api/v1/${collection}`;
    const keys = this.getKeys(pattern);

    for (const key of keys) {
      const cached = this.get<{ data: unknown[] }>(key);
      if (cached && Array.isArray(cached.data)) {
        cached.data = cached.data.filter((item: any) => item.id !== itemId);
        // Refresh the cache entry
        this.set(key, cached, DEFAULT_CACHE_TTL);
      }
    }
  }

  /**
   * Add item to all collection caches
   */
  addItemToCollection<T>(collection: string, newItem: T): void {
    const pattern = `/api/v1/${collection}`;
    const keys = this.getKeys(pattern);

    for (const key of keys) {
      const cached = this.get<{ data: T[] }>(key);
      if (cached && Array.isArray(cached.data)) {
        cached.data.unshift(newItem); // Add to beginning
        // Refresh the cache entry
        this.set(key, cached, DEFAULT_CACHE_TTL);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Default TTL: 60 seconds for general queries
export const DEFAULT_CACHE_TTL = 60_000;

// Helper to generate cache keys from request params
export function generateCacheKey(path: string, params: Record<string, string | null>): string {
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  return sortedParams ? `${path}?${sortedParams}` : path;
}
