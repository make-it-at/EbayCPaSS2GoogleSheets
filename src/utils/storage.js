// ebayCPaSS2GoogleSheets Storage Utilities

/**
 * Chrome Storage管理用のユーティリティ関数
 */

// ストレージキーの定数
const STORAGE_KEYS = {
    EXTRACTION_SETTINGS: 'extractionSettings',
    SHEETS_CONFIG: 'sheetsConfig',
    SELECTORS: 'selectors',
    EXTRACTED_DATA: 'extractedData',
    LAST_EXTRACTION: 'lastExtraction'
};

/**
 * 設定をローカルストレージから取得
 * @param {string} key - 取得するキー
 * @returns {Promise<any>} - 取得したデータ
 */
function getFromStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get([key], function(result) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result[key]);
            }
        });
    });
}

/**
 * 設定をローカルストレージに保存
 * @param {string} key - 保存するキー
 * @param {any} value - 保存する値
 * @returns {Promise<void>}
 */
function saveToStorage(key, value) {
    return new Promise((resolve, reject) => {
        const data = {};
        data[key] = value;
        
        chrome.storage.sync.set(data, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * 複数の設定を一度に取得
 * @param {string[]} keys - 取得するキーの配列
 * @returns {Promise<object>} - 取得したデータのオブジェクト
 */
function getMultipleFromStorage(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(keys, function(result) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * 複数の設定を一度に保存
 * @param {object} data - 保存するデータのオブジェクト
 * @returns {Promise<void>}
 */
function saveMultipleToStorage(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(data, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * ローカルストレージからデータを取得
 * @param {string} key - 取得するキー
 * @returns {Promise<any>} - 取得したデータ
 */
function getFromLocalStorage(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], function(result) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result[key]);
            }
        });
    });
}

/**
 * ローカルストレージにデータを保存
 * @param {string} key - 保存するキー
 * @param {any} value - 保存する値
 * @returns {Promise<void>}
 */
function saveToLocalStorage(key, value) {
    return new Promise((resolve, reject) => {
        const data = {};
        data[key] = value;
        
        chrome.storage.local.set(data, function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * 抽出設定を取得
 * @returns {Promise<object>} - 抽出設定
 */
async function getExtractionSettings() {
    const settings = await getFromStorage(STORAGE_KEYS.EXTRACTION_SETTINGS);
    return settings || {
        autoExtract: false,
        saveToSheets: true,
        showNotifications: true
    };
}

/**
 * Google Sheets設定を取得
 * @returns {Promise<object>} - Google Sheets設定
 */
async function getSheetsConfig() {
    const config = await getFromStorage(STORAGE_KEYS.SHEETS_CONFIG);
    return config || {
        spreadsheetId: null,
        sheetName: 'ebayCPaSS抽出データ'
    };
}

/**
 * セレクター設定を取得
 * @returns {Promise<object>} - セレクター設定
 */
async function getSelectors() {
    const selectors = await getFromStorage(STORAGE_KEYS.SELECTORS);
    return selectors || {
        estimatedShippingCost: 'div span.value',
        trackingNumber: 'a span',
        lastMileTrackingNumber: 'span.bold'
    };
}

/**
 * 抽出データを取得
 * @returns {Promise<array>} - 抽出データの配列
 */
async function getExtractedData() {
    const data = await getFromLocalStorage(STORAGE_KEYS.EXTRACTED_DATA);
    return data || [];
}

/**
 * 抽出データを保存
 * @param {object} newData - 新しい抽出データ
 * @returns {Promise<void>}
 */
async function saveExtractedData(newData) {
    const existingData = await getExtractedData();
    
    // 新しいデータにIDとタイムスタンプを追加
    const dataWithId = {
        ...newData,
        id: Date.now().toString(),
        savedAt: new Date().toISOString()
    };
    
    // 既存データに追加
    existingData.push(dataWithId);
    
    // 最新の100件のみ保持
    if (existingData.length > 100) {
        existingData.splice(0, existingData.length - 100);
    }
    
    await saveToLocalStorage(STORAGE_KEYS.EXTRACTED_DATA, existingData);
    return dataWithId;
}

/**
 * 最後の抽出情報を取得
 * @returns {Promise<object|null>} - 最後の抽出情報
 */
async function getLastExtraction() {
    return await getFromLocalStorage(STORAGE_KEYS.LAST_EXTRACTION);
}

/**
 * 最後の抽出情報を保存
 * @param {object} extractionInfo - 抽出情報
 * @returns {Promise<void>}
 */
async function saveLastExtraction(extractionInfo) {
    await saveToLocalStorage(STORAGE_KEYS.LAST_EXTRACTION, extractionInfo);
}

/**
 * 全ての設定をデフォルト値にリセット
 * @returns {Promise<void>}
 */
async function resetAllSettings() {
    const defaultSettings = {
        [STORAGE_KEYS.EXTRACTION_SETTINGS]: {
            autoExtract: false,
            saveToSheets: true,
            showNotifications: true
        },
        [STORAGE_KEYS.SHEETS_CONFIG]: {
            spreadsheetId: null,
            sheetName: 'ebayCPaSS抽出データ'
        },
        [STORAGE_KEYS.SELECTORS]: {
            estimatedShippingCost: 'div span.value',
            trackingNumber: 'a span',
            lastMileTrackingNumber: 'span.bold'
        }
    };
    
    await saveMultipleToStorage(defaultSettings);
}

/**
 * ローカルストレージの全データを削除
 * @returns {Promise<void>}
 */
function clearLocalStorage() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.clear(function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * 同期ストレージの全データを削除
 * @returns {Promise<void>}
 */
function clearSyncStorage() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.clear(function() {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * ストレージ使用量を取得
 * @returns {Promise<object>} - 使用量情報
 */
function getStorageUsage() {
    return new Promise((resolve, reject) => {
        Promise.all([
            new Promise((res, rej) => {
                chrome.storage.sync.getBytesInUse(null, function(bytes) {
                    if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
                    else res(bytes);
                });
            }),
            new Promise((res, rej) => {
                chrome.storage.local.getBytesInUse(null, function(bytes) {
                    if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
                    else res(bytes);
                });
            })
        ])
        .then(([syncBytes, localBytes]) => {
            resolve({
                sync: {
                    used: syncBytes,
                    limit: chrome.storage.sync.QUOTA_BYTES,
                    percentage: (syncBytes / chrome.storage.sync.QUOTA_BYTES) * 100
                },
                local: {
                    used: localBytes,
                    limit: chrome.storage.local.QUOTA_BYTES,
                    percentage: (localBytes / chrome.storage.local.QUOTA_BYTES) * 100
                }
            });
        })
        .catch(reject);
    });
}

// エクスポート（モジュール形式ではないため、グローバル変数として定義）
if (typeof window !== 'undefined') {
    window.StorageUtils = {
        STORAGE_KEYS,
        getFromStorage,
        saveToStorage,
        getMultipleFromStorage,
        saveMultipleToStorage,
        getFromLocalStorage,
        saveToLocalStorage,
        getExtractionSettings,
        getSheetsConfig,
        getSelectors,
        getExtractedData,
        saveExtractedData,
        getLastExtraction,
        saveLastExtraction,
        resetAllSettings,
        clearLocalStorage,
        clearSyncStorage,
        getStorageUsage
    };
} 