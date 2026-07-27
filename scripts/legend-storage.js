(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_PREFIX = 'legend-saju:';
  const RECORD_PREFIX = 'legend-saju:record:';
  const FALLBACK_KEY = 'legend-saju:records';
  const THEME_KEY = 'legend-saju:theme';

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

  function createRecordStore(storage, fallbackStorage) {
    function readFallbackRecords() {
      try {
        const records = JSON.parse(fallbackStorage.getItem(FALLBACK_KEY) || '[]');
        return Array.isArray(records) ? records.filter(validRecord) : [];
      } catch (error) {
        return [];
      }
    }

    function writeFallbackRecords(records) {
      fallbackStorage.setItem(FALLBACK_KEY, JSON.stringify(records));
    }

    function removeFallbackRecord(id) {
      const records = readFallbackRecords();
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

    async function listRecords() {
      const merged = new Map();
      try {
        const result = await storage.list(RECORD_PREFIX);
        const keys = result && Array.isArray(result.keys) ? result.keys : [];
        for (const key of keys) {
          if (!key.startsWith(RECORD_PREFIX)) continue;
          try {
            const result = await storage.get(key);
            const record = result && parseRecord(result.value);
            if (record) merged.set(record.id, record);
          } catch (error) {
            // A single damaged entry must not hide the rest of the saved charts.
          }
        }
      } catch (error) {
        // The fallback set remains visible when the primary backend is unavailable.
      }
      for (const record of readFallbackRecords()) merged.set(record.id, record);
      return [...merged.values()];
    }

    async function getRecord(id) {
      try {
        const result = await storage.get(RECORD_PREFIX + id);
        const record = result && parseRecord(result.value);
        if (record) return record;
      } catch (error) {
        // Continue into the fallback set.
      }
      return readFallbackRecords().find(record => record.id === id) || null;
    }

    async function saveRecord(record) {
      if (!validRecord(record)) throw new Error('저장할 명반 형식이 올바르지 않습니다.');
      try {
        await storage.set(RECORD_PREFIX + record.id, JSON.stringify(record));
        removeFallbackRecord(record.id);
        return record;
      } catch (primaryError) {
        try {
          upsertFallbackRecord(record);
          return record;
        } catch (fallbackError) {
          throw new Error('명반을 저장하지 못했습니다.');
        }
      }
    }

    async function deleteRecord(id) {
      let primaryError = null;
      try {
        await storage.delete(RECORD_PREFIX + id);
      } catch (error) {
        primaryError = error;
      }
      removeFallbackRecord(id);
      if (primaryError) throw new Error('명반을 삭제하지 못했습니다.');
    }

    async function updateRecord(id, patch) {
      const record = await getRecord(id);
      if (!record) return null;
      Object.assign(record, patch);
      return saveRecord(record);
    }

    async function importRecords(records) {
      if (!Array.isArray(records)) throw new Error('가져올 명반 형식이 올바르지 않습니다.');
      const writes = [];
      try {
        for (const record of records) {
          if (!validRecord(record)) throw new Error('가져올 명반 형식이 올바르지 않습니다.');
          const key = RECORD_PREFIX + record.id;
          const previous = await storage.get(key);
          await storage.set(key, JSON.stringify(record));
          writes.push({ key, previous });
        }
      } catch (error) {
        for (const write of writes.reverse()) {
          try {
            if (write.previous && typeof write.previous.value === 'string') {
              await storage.set(write.key, write.previous.value);
            } else {
              await storage.delete(write.key);
            }
          } catch (rollbackError) {
            // Continue rollback attempts for every record before reporting failure.
          }
        }
        throw new Error('가져오기를 저장하지 못했습니다. 기존 명반은 그대로 유지됩니다.');
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
    createRecordStore
  });
});
