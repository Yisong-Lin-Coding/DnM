/**
 * Delta Update System
 * 
 * Provides utilities for computing and applying state diffs to reduce
 * network bandwidth and improve latency.
 * 
 * Usage:
 * - Server: compute patches between snapshots and send to clients
 * - Client: apply patches to maintain local state
 */

class DeltaUpdateManager {
  constructor() {
    // Track baseline state per socket for computing deltas
    this.clientBaselines = new Map(); // socketId -> { snapshot, revision, timestamp }
    this.snapshotCache = new Map(); // campaignId -> { snapshot, revision }
  }

  /**
   * Get or create baseline state for a client
   */
  getClientBaseline(socketId) {
    return this.clientBaselines.get(socketId);
  }

  /**
   * Update baseline state after sending to client
   */
  setClientBaseline(socketId, snapshot, revision) {
    this.clientBaselines.set(socketId, {
      snapshot: JSON.parse(JSON.stringify(snapshot)), // Deep copy
      revision,
      timestamp: Date.now()
    });
  }

  /**
   * Clear baseline when client disconnects
   */
  clearClientBaseline(socketId) {
    this.clientBaselines.delete(socketId);
  }

  /**
   * Compute delta patch between two snapshots
   * Returns an object with only changed fields
   */
  computeStatePatch(previousSnapshot, currentSnapshot, options = {}) {
    const patch = {};

    // Compare characters
    if (previousSnapshot && currentSnapshot) {
      const prevCharMap = this.arrayToMap(previousSnapshot.characters, 'id');
      const currCharMap = this.arrayToMap(currentSnapshot.characters, 'id');

      patch.characters = this.computeMapDiff(prevCharMap, currCharMap, {
        excludeFields: options.excludeCharacterFields || [
          'visionRays', // Will optimize separately
          '_debugLightLevel',
          'vision', // Include only if position changed
          'visionRadius',
          'visionAngle',
          'visionDistance'
        ]
      });

      // Compare map objects
      const prevObjMap = this.arrayToMap(previousSnapshot.mapObjects, 'id');
      const currObjMap = this.arrayToMap(currentSnapshot.mapObjects, 'id');
      patch.mapObjects = this.computeMapDiff(prevObjMap, currObjMap);

      // Compare lighting
      if (this.deepHasChanged(previousSnapshot.lighting, currentSnapshot.lighting)) {
        patch.lighting = currentSnapshot.lighting;
      }

      // Don't send lighting polygons - recompute client-side
      // if (this.deepHasChanged(previousSnapshot.lightingPolygons, currentSnapshot.lightingPolygons)) {
      //   patch.lightingPolygons = currentSnapshot.lightingPolygons;
      // }

      // Compare journal state
      if (this.deepHasChanged(previousSnapshot.journalState, currentSnapshot.journalState)) {
        patch.journalState = currentSnapshot.journalState;
      }

      // Compare other top-level fields
      const topLevelFields = ['currentZLevel', 'visionRayCount', 'mapGeometry', 'fovMode'];
      topLevelFields.forEach(field => {
        if (this.deepHasChanged(previousSnapshot[field], currentSnapshot[field])) {
          patch[field] = currentSnapshot[field];
        }
      });
    }

    return patch;
  }

  /**
   * Convert array to map by ID for efficient comparison
   */
  arrayToMap(arr, idKey = 'id') {
    const map = new Map();
    if (Array.isArray(arr)) {
      arr.forEach(item => {
        const id = String(item[idKey] || '');
        if (id) map.set(id, item);
      });
    }
    return map;
  }

  /**
   * Compute diff between two maps (keyed by ID)
   */
  computeMapDiff(prevMap, currMap, options = {}) {
    const diff = {};
    const excludeFields = new Set(options.excludeFields || []);

    // Check for changed and new items
    currMap.forEach((currItem, id) => {
      const prevItem = prevMap.get(id);
      if (!prevItem) {
        // New item - include full data
        diff[id] = currItem;
      } else {
        // Existing item - compute field-level diff
        const itemDiff = this.computeObjectDiff(prevItem, currItem, excludeFields);
        if (Object.keys(itemDiff).length > 0) {
          diff[id] = itemDiff;
        }
      }
    });

    // Check for deleted items (could send tombstones if needed)
    prevMap.forEach((_, id) => {
      if (!currMap.has(id)) {
        diff[id] = null; // Tombstone indicating deletion
      }
    });

    return diff;
  }

  /**
   * Compute field-level diff for an object
   */
  computeObjectDiff(prevObj, currObj, excludeFields = new Set()) {
    const diff = {};

    // Check all fields in current object
    for (const key in currObj) {
      if (excludeFields.has(key)) continue;

      const prevValue = prevObj[key];
      const currValue = currObj[key];

      if (this.deepHasChanged(prevValue, currValue)) {
        diff[key] = currValue;
      }
    }

    // Check for deleted fields
    for (const key in prevObj) {
      if (!(key in currObj) && !excludeFields.has(key)) {
        diff[key] = undefined; // Mark for deletion
      }
    }

    return diff;
  }

  /**
   * Deep equality check - handles nested objects and arrays
   */
  deepHasChanged(prev, curr) {
    if (prev === curr) return false;

    if (prev === null || prev === undefined || curr === null || curr === undefined) {
      return prev !== curr;
    }

    const prevType = typeof prev;
    const currType = typeof curr;

    if (prevType !== currType) return true;

    if (prevType === 'object') {
      // Handle arrays
      if (Array.isArray(prev) && Array.isArray(curr)) {
        if (prev.length !== curr.length) return true;
        for (let i = 0; i < prev.length; i++) {
          if (this.deepHasChanged(prev[i], curr[i])) return true;
        }
        return false;
      }

      // Handle objects
      if (!Array.isArray(prev) && !Array.isArray(curr)) {
        const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
        for (const key of allKeys) {
          if (this.deepHasChanged(prev[key], curr[key])) return true;
        }
        return false;
      }

      return true; // One is array, one is object
    }

    return String(prev) !== String(curr);
  }

  /**
   * Serialize a state patch for transmission
   */
  serializePatch(patch) {
    // For now, just return as-is
    // In future, could implement binary compression here
    return patch;
  }

  /**
   * Deserialize a state patch from transmission
   */
  deserializePatch(patch) {
    return patch;
  }

  /**
   * Determine if full snapshot should be sent instead of delta
   */
  shouldSendFullSnapshot(socketId, clientRevision, currentRevision) {
    const baseline = this.getClientBaseline(socketId);
    
    if (!baseline) return true; // No baseline = first time, send full
    if (baseline.revision < 0) return true; // Negative revision = invalid state
    if (currentRevision - baseline.revision > 10) return true; // Too many revisions, safe to refresh
    if (Date.now() - baseline.timestamp > 60000) return true; // Client hasn't updated in 1 minute

    return false;
  }
}

// Export singleton instance
const deltaManager = new DeltaUpdateManager();

module.exports = deltaManager;
