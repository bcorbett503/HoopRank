import { Injectable } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

/**
 * Thin wrapper around lru-cache providing namespaced,
 * TTL-aware in-memory caching for hot paths.
 *
 * Usage:
 *   const val = cache.get('rankings', key);
 *   if (!val) { val = await computeExpensiveThing(); cache.set('rankings', key, val); }
 */
@Injectable()
export class CacheService {
    private caches = new Map<string, LRUCache<string, any>>();

    /** Default TTLs per namespace (ms) */
    private static readonly DEFAULTS: Record<string, { max: number; ttl: number }> = {
        rankings: { max: 50, ttl: 5 * 60 * 1000 },   // 5 min
        feed: { max: 200, ttl: 2 * 60 * 1000 },   // 2 min
        courts: { max: 100, ttl: 10 * 60 * 1000 },  // 10 min
    };

    private getOrCreateCache(namespace: string): LRUCache<string, any> {
        let cache = this.caches.get(namespace);
        if (!cache) {
            const opts = CacheService.DEFAULTS[namespace] || { max: 100, ttl: 5 * 60 * 1000 };
            cache = new LRUCache<string, any>(opts);
            this.caches.set(namespace, cache);
        }
        return cache;
    }

    get<T = any>(namespace: string, key: string): T | undefined {
        return this.getOrCreateCache(namespace).get(key) as T | undefined;
    }

    set(namespace: string, key: string, value: any): void {
        this.getOrCreateCache(namespace).set(key, value);
    }

    /** Invalidate a single key */
    del(namespace: string, key: string): void {
        this.getOrCreateCache(namespace).delete(key);
    }

    /** Invalidate all keys within a namespace */
    invalidateNamespace(namespace: string): void {
        this.caches.get(namespace)?.clear();
    }

    /** Invalidate everything (e.g. after a migration) */
    invalidateAll(): void {
        for (const cache of this.caches.values()) {
            cache.clear();
        }
    }
}
