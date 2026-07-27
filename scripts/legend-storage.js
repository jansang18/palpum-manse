(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_PREFIX = 'palpum-manse:';
  const RECORD_PREFIX = 'palpum-manse:record:';
  const FALLBACK_KEY = 'palpum-manse:records';
  const THEME_KEY = 'palpum-manse:theme';
  const LEGACY_RECORD_PREFIX = 'legend-saju:record:';
  const LEGACY_FALLBACK_KEY = 'legend-saju:records';
  const LEGACY_COPY_KEY = 'palpum-manse:legacy-copy-v1';

  function validRecord(record) {
    return record && typeof record === 'object' && !Array.isArray(record) &&
      typeof record.id === 'string' && record.id.length > 0;
  }

  function parseRecord(value) {
    try {
      const record = JSON.parse(value);
      return validRecord(record) ? record : null;
    } catch (error) {
      return null;
    }
  }

  function storageUnavailable(cause) {
    const error = new Error('저장소 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    error.name = 'LegendStorageUnavailableError';
    error.code = 'LEGEND_STORAGE_UNAVAILABLE';
    error.cause = cause;
    return error;
  }

  function createRecordStore(storage, fallbackStorage) {
    function readFallbackRecordsAt(key, strict) {
      let value;
      try {
        value = fallbackStorage.getItem(key);
      } catch (error) {
        throw storageUnavailable(error);
      }
      if (value === null || value === '') return [];
      try {
        const records = JSON.parse(value);
        if (!Array.isArray(records)) throw new TypeError('Fallback records must be an array.');
        return records.filter(validRecord);
      } catch (error) {
        if (!strict) return [];
        throw storageUnavailable(error);
      }
    }

    function readFallbackRecords() {
      return readFallbackRecordsAt(FALLBACK_KEY, true);
    }

    function writeFallbackRecords(records) {
      fallbackStorage.setItem(FALLBACK_KEY, JSON.stringify(records));
    }

    function removeFallbackRecord(id, records = readFallbackRecords()) {
      const next = records.filter(record => record.id !== id);
      if (next.length !== records.length) writeFallbackRecords(next);
    }

    function upsertFallbackRecord(record) {
      const records = readFallbackRecords();
      const index = records.findIndex(item => item.id === record.id);
      if (index >= 0) records[index] = record;
      else records.push(record);
      writeFallbackRecords(records);
    }

    let legacyCopyPromise = null;

    async function copyLegacyRecordsOnce() {
      let marker;
      try {
        marker = await storage.get(LEGACY_COPY_KEY);
      } catch (error) {
        throw storageUnavailable(error);
      }
      let fallbackMarker;
      try {
        fallbackMarker = fallbackStorage.getItem(LEGACY_COPY_KEY);
      } catch (error) {
        throw storageUnavailable(error);
      }
      if ((marker && marker.value === '1') || fallbackMarker === '1') return;

      let legacyKeys;
      try {
        const result = await storage.list(LEGACY_RECORD_PREFIX);
        legacyKeys = result && Array.isArray(result.keys) ? result.keys : [];
      } catch (error) {
        throw storageUnavailable(error);
      }

      const discovered = new Map();
      for (const key of legacyKeys) {
        if (!key.startsWith(LEGACY_RECORD_PREFIX)) continue;
        let stored;
        try {
          stored = await storage.get(key);
        } catch (error) {
          throw storageUnavailable(error);
        }
        const record = stored && parseRecord(stored.value);
        if (record) discovered.set(record.id, record);
      }
      for (const record of readFallbackRecordsAt(LEGACY_FALLBACK_KEY, false)) {
        discovered.set(record.id, record);
      }
      if (discovered.size === 0) return;

      const fallbackIds = new Set(readFallbackRecords().map(record => record.id));
      for (const record of discovered.values()) {
        const key = RECORD_PREFIX + record.id;
        let existing;
        try {
          existing = await storage.get(key);
        } catch (error) {
          throw storageUnavailable(error);
        }
        if ((existing && parseRecord(existing.value)) || fallbackIds.has(record.id)) continue;
        try {
          await storage.set(key, JSON.stringify(record));
        } catch (primaryError) {
          try {
            upsertFallbackRecord(record);
            fallbackIds.add(record.id);
          } catch (fallbackError) {
            throw storageUnavailable(fallbackError);
          }
        }
      }

      try {
        await storage.set(LEGACY_COPY_KEY, '1');
      } catch (primaryError) {
        try {
          fallbackStorage.setItem(LEGACY_COPY_KEY, '1');
        } catch (fallbackError) {
          throw storageUnavailable(fallbackError);
        }
      }
    }

    function ensureLegacyRecordsCopied() {
      if (!legacyCopyPromise) {
        legacyCopyPromise = copyLegacyRecordsOnce().catch(error => {
          legacyCopyPromise = null;
          throw error;
        });
      }
      return legacyCopyPromise;
    }

    async function listRecords() {
      await ensureLegacyRecordsCopied();
      const merged = new Map();
      let result;
      try {
        result = await storage.list(RECORD_PREFIX);
      } catch (error) {
        throw storageUnavailable(error);
      }
      const keys = result && Array.isArray(result.keys) ? result.keys : [];
      for (const key of keys) {
        if (!key.startsWith(RECORD_PREFIX)) continue;
        let stored;
        try {
          stored = await storage.get(key);
        } catch (error) {
          throw storageUnavailable(error);
        }
        const record = stored && parseRecord(stored.value);
        if (record) merged.set(record.id, record);
      }
      for (const record of readFallbackRecords()) merged.set(record.id, record);
      return [...merged.values()];
    }

    async function getRecord(id) {
      const fallbackRecord = readFallbackRecords().find(record => record.id === id);
      let result;
      try {
        result = await storage.get(RECORD_PREFIX + id);
      } catch (error) {
        throw storageUnavailable(error);
      }
      const primaryRecord = result && parseRecord(result.value);
      return fallbackRecord || primaryRecord || null;
    }

    async function saveRecord(record) {
      if (!validRecord(record)) throw new Error('저장할 명반 형식이 올바르지 않습니다.');
      try {
        await storage.set(RECORD_PREFIX + record.id, JSON.stringify(record));
      } catch (primaryError) {
        try {
          upsertFallbackRecord(record);
          return record;
        } catch (fallbackError) {
          throw new Error('명반을 저장하지 못했습니다.');
        }
      }
      try {
        removeFallbackRecord(record.id);
      } catch (fallbackError) {
        try {
          upsertFallbackRecord(record);
        } catch (syncError) {
          throw new Error('명반의 최신 저장 상태를 동기화하지 못했습니다.');
        }
      }
      return record;
    }

    async function deleteRecord(id) {
      const fallbackRecords = readFallbackRecords();
      try {
        await storage.delete(RECORD_PREFIX + id);
      } catch (error) {
        throw new Error('명반을 삭제하지 못했습니다. 최신 저장본을 유지합니다.');
      }
      try {
        removeFallbackRecord(id, fallbackRecords);
      } catch (error) {
        throw new Error('명반을 완전히 삭제하지 못했습니다. 복구 가능한 저장본을 유지합니다.');
      }
    }

    async function updateRecord(id, patch) {
      const record = await getRecord(id);
      if (!record) return null;
      Object.assign(record, patch);
      return saveRecord(record);
    }

    async function importRecords(records) {
      if (!Array.isArray(records)) throw new Error('가져올 명반 형식이 올바르지 않습니다.');
      const attempts = [];
      try {
        for (const record of records) {
          if (!validRecord(record)) throw new Error('가져올 명반 형식이 올바르지 않습니다.');
          const key = RECORD_PREFIX + record.id;
          const previous = await storage.get(key);
          attempts.push({ key, id: record.id, previous });
          await storage.set(key, JSON.stringify(record));
        }
      } catch (error) {
        for (const attempt of [...attempts].reverse()) {
          try {
            if (attempt.previous && typeof attempt.previous.value === 'string') {
              await storage.set(attempt.key, attempt.previous.value);
            } else {
              await storage.delete(attempt.key);
            }
          } catch (rollbackError) {
            // Verification below determines whether the failed operation restored the value.
          }
        }

        const baselines = new Map();
        for (const attempt of attempts) {
          if (!baselines.has(attempt.key)) baselines.set(attempt.key, attempt);
        }
        const residualIds = [];
        for (const baseline of baselines.values()) {
          try {
            const current = await storage.get(baseline.key);
            const restored = baseline.previous && typeof baseline.previous.value === 'string'
              ? current && current.value === baseline.previous.value
              : current === null || current === undefined;
            if (!restored) residualIds.push(baseline.id);
          } catch (verificationError) {
            residualIds.push(baseline.id);
          }
        }
        if (residualIds.length) {
          const rollbackError = new Error(
            `가져오기를 저장하지 못했습니다. 롤백이 완료되지 않았습니다. 잔여 ${residualIds.length}개: ${residualIds.join(', ')}`
          );
          rollbackError.rollbackIncomplete = true;
          rollbackError.residualCount = residualIds.length;
          rollbackError.residualIds = residualIds;
          throw rollbackError;
        }
        throw new Error('가져오기를 저장하지 못했습니다. 변경 사항을 롤백했습니다.');
      }
      return records.length;
    }

    return Object.freeze({
      listRecords,
      getRecord,
      saveRecord,
      deleteRecord,
      updateRecord,
      importRecords
    });
  }

  return Object.freeze({
    STORAGE_PREFIX,
    RECORD_PREFIX,
    FALLBACK_KEY,
    THEME_KEY,
    LEGACY_RECORD_PREFIX,
    LEGACY_FALLBACK_KEY,
    LEGACY_COPY_KEY,
    createRecordStore
  });
});
