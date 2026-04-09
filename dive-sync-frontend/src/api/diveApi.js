import axiosClient from './axiosClient';

/**
 * 取得潛水遙測資料 (深度 / 水溫 / GPS 等)
 * @param {number|string} diveId
 * @param {object} [params] - query params, e.g. { startTime, endTime }
 */
export const getDiveTelemetry = (diveId, params) =>
  axiosClient.get(`/dives/${diveId}/telemetry`, { params });

/**
 * 上傳 Garmin .FIT 檔案
 * @param {File} file
 */
export const uploadFitFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient.post('/dives/upload-fit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const pingBackend = () =>
  axiosClient.get('/dives');

export const rescanFitDirectory = (directory) =>
  axiosClient.post('/fit-import/rescan', { directory });

/**
 * 取得潛水清單
 * @param {object} [params] - pagination / filter
 */
export const getDiveList = (params) =>
  axiosClient.get('/dives', { params });

/**
 * 取得單次潛水詳情
 */
export const getDiveDetail = (diveId) =>
  axiosClient.get(`/dives/${diveId}`);

/**
 * 取得影片同步元資料
 */
export const getVideoSyncMetadata = (diveId) =>
  axiosClient.get(`/dives/${diveId}/video-sync`);

/**
 * 從 Garmin 雲端同步最新一筆潛水紀錄
 */
export const syncGarmin = () =>
  axiosClient.post('/dives/sync-garmin', {});

/**
 * 用帳號密碼登入 Garmin（取得 OAuth token 存在後端記憶體）
 * @param {string} username
 * @param {string} password
 */
export const garminLogin = (username, password) =>
  axiosClient.post('/dives/garmin-login', { username, password });
