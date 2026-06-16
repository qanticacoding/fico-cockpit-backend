/**
 * SAP Set Client
 * 
 * Reads SAP Sets dynamically from API (real-time, NOT stored in DB)
 * Provides optional in-memory cache with TTL to reduce API calls
 * 
 * API: GET /sap/bc/ybreakeven/yset?setclass={setclass}&setname={setname}
 * Returns: { setData: [{keyid, description}], setHier: [...] }
 * 
 * Set Classes:
 * - 0109: GL Accounts (Conti) - flat structure
 * - 0101: Cost Centers (CDC) - hierarchical structure
 */

import axios from 'axios';
import sapConfig from '../../config/sap.config.js';
import logger from '../utils/logger.js';

class SapSetClient {
  constructor(options = {}) {
    this.enableCache = options.enableCache !== false; // Default: true
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // Default: 5 minutes
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalCalls: 0
    };
  }

  /**
   * Fetch a Set from SAP API
   * @param {string} setclass - Set class (0109=Accounts, 0101=Cost Centers)
   * @param {string} setname - Set name (e.g., 'SG_A', 'PRD')
   * @returns {Promise<Object>} { members: string[], metadata: {...}, cached: boolean }
   */
  async fetchSet(setclass, setname) {
    const cacheKey = `${setclass}:${setname}`;
    this.stats.totalCalls++;

    // Check cache first
    if (this.enableCache && this._isCacheValid(cacheKey)) {
      this.stats.hits++;
      logger.debug(`[SET CLIENT] Cache HIT: ${cacheKey}`);
      const cached = this.cache.get(cacheKey);
      return { ...cached.data, cached: true };
    }

    this.stats.misses++;
    logger.debug(`[SET CLIENT] Cache MISS: ${cacheKey} - Fetching from SAP...`);

    try {
      // Build URL
      const url = sapConfig.buildSetUrl(setclass, setname);
      logger.info(`[SET CLIENT] Fetching Set: ${setclass}/${setname}`);
      logger.debug(`[SET CLIENT] URL: ${url}`);

      // Make API call
      const response = await axios.get(url, {
        timeout: sapConfig.setApi.timeout,
        headers: {
          'Accept': 'application/json'
        }
      });

      // Parse response
      const result = this._parseSetResponse(response.data, setclass, setname);

      // Store in cache
      if (this.enableCache) {
        this.cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
        logger.debug(`[SET CLIENT] Cached: ${cacheKey} (${result.members.length} members, TTL: ${this.cacheTTL}ms)`);
      }

      return { ...result, cached: false };

    } catch (error) {
      this.stats.errors++;
      logger.error(`[SET CLIENT] Error fetching Set ${setclass}/${setname}:`, error.message);
      
      // Provide detailed error context
      if (error.response) {
        logger.error(`[SET CLIENT] Response status: ${error.response.status}`);
        logger.error(`[SET CLIENT] Response data:`, error.response.data);
      } else if (error.request) {
        logger.error(`[SET CLIENT] No response received - Network error or timeout`);
      }

      throw new Error(`Failed to fetch SAP Set ${setclass}/${setname}: ${error.message}`);
    }
  }

  /**
   * Parse SAP Set API response
   * Extracts member IDs from setData array
   * @private
   */
  _parseSetResponse(data, setclass, setname) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format: expected JSON object');
    }

    // SAP API returns array with one object: [{ setData: [...], setHier: [...] }]
    // Extract first element if data is array
    const responseData = Array.isArray(data) ? data[0] : data;

    // Extract members from setData array
    const setData = responseData?.setData || [];
    const members = setData.map(item => ({
      keyid: item.keyid,
      description: item.description
    })).filter(item => item.keyid);

    if (members.length === 0) {
      logger.warn(`[SET CLIENT] Set ${setclass}/${setname} returned 0 members`);
    }

    // Extract hierarchy info (mainly for 0101 Cost Centers)
    const setHier = responseData?.setHier || [];
    const isHierarchical = setHier.length > 1; // More than just root node

    // Build metadata
    const metadata = {
      setclass,
      setname,
      memberCount: members.length,
      isHierarchical,
      hierarchyLevels: isHierarchical ? Math.max(...setHier.map(h => h.hierlevel || 0)) + 1 : 1,
      fetchedAt: new Date().toISOString()
    };

    logger.info(`[SET CLIENT] Parsed Set ${setclass}/${setname}: ${members.length} members, hierarchical: ${isHierarchical}`);

    return {
      members,
      metadata,
      rawHierarchy: setHier.length > 0 ? setHier : undefined
    };
  }

  /**
   * Check if cached entry is still valid
   * @private
   */
  _isCacheValid(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    if (age > this.cacheTTL) {
      this.cache.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * Test connectivity to SAP Set API
   * Uses a known set to verify connection
   */
  async testConnection(testSetClass = '0109', testSetName = 'SG_A') {
    try {
      logger.info(`[SET CLIENT] Testing connection with ${testSetClass}/${testSetName}...`);
      const result = await this.fetchSet(testSetClass, testSetName);
      logger.info(`[SET CLIENT] Connection test SUCCESS - Retrieved ${result.members.length} members`);
      return {
        success: true,
        message: `Connection OK - Retrieved ${result.members.length} members`,
        setClass: testSetClass,
        setName: testSetName,
        memberCount: result.members.length
      };
    } catch (error) {
      logger.error(`[SET CLIENT] Connection test FAILED:`, error.message);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const cacheSize = this.cache.size;
    const hitRate = this.stats.totalCalls > 0 
      ? ((this.stats.hits / this.stats.totalCalls) * 100).toFixed(2) 
      : 0;

    // Get cache entries with age
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      memberCount: value.data.members.length,
      expiresIn: this.cacheTTL - (Date.now() - value.timestamp)
    }));

    return {
      enabled: this.enableCache,
      ttl: this.cacheTTL,
      size: cacheSize,
      stats: {
        totalCalls: this.stats.totalCalls,
        hits: this.stats.hits,
        misses: this.stats.misses,
        errors: this.stats.errors,
        hitRate: `${hitRate}%`
      },
      entries
    };
  }

  /**
   * Clear all cache entries
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`[SET CLIENT] Cache cleared (${size} entries removed)`);
    return { cleared: size };
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(setclass, setname) {
    const cacheKey = `${setclass}:${setname}`;
    const existed = this.cache.delete(cacheKey);
    if (existed) {
      logger.info(`[SET CLIENT] Cache entry cleared: ${cacheKey}`);
    }
    return { cleared: existed };
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance
 */
export function getInstance(options) {
  if (!instance) {
    instance = new SapSetClient(options);
  }
  return instance;
}

/**
 * Create new instance (for testing)
 */
export function createInstance(options) {
  return new SapSetClient(options);
}

export default { getInstance, createInstance };
