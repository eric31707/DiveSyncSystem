import { useState, useEffect, useCallback, useRef } from 'react';
import { getDiveTelemetry } from '../api/diveApi';

/**
 * useDiveTelemetry
 *
 * @param {number|string|null} diveId - 潛水 ID，null 時不發請求
 * @param {object} [options]
 * @param {object} [options.params]     - 額外 query params
 * @param {boolean} [options.enabled]   - 是否啟用（預設 true）
 * @param {number}  [options.interval]  - 輪詢間隔 ms（0 = 不輪詢）
 *
 * @returns {{ data, isLoading, error, refetch }}
 */
export function useDiveTelemetry(diveId, options = {}) {
  const { params, enabled = true, interval = 0 } = options;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // ★ 用 ref 穩定 params 參考，避免 object 每次 render 都觸發 useCallback 重建
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchData = useCallback(async () => {
    if (!diveId || !enabled) return;

    // 取消前一次尚未完成的請求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getDiveTelemetry(diveId, {
        ...paramsRef.current,
        signal: controller.signal,
      });
      setData(result);
    } catch (err) {
      if (err.name !== 'CanceledError') {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [diveId, enabled]);

  // 初始 fetch + diveId 變更時重新 fetch
  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // 輪詢
  useEffect(() => {
    if (!interval || !enabled) return;
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, interval, enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

