// ebayCPaSS2GoogleSheets Popup JavaScript

console.log('ebayCPaSS2GoogleSheets popup loaded');

// DOM要素を取得
const elements = {
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    extractBtn: document.getElementById('extractBtn'),
    saveBtn: document.getElementById('saveBtn'),
    copyBtn: document.getElementById('copyBtn'),
    bulkCopyBtn: document.getElementById('bulkCopyBtn'),
    dataSection: document.getElementById('dataSection'),
    shippingCost: document.getElementById('shippingCost'),
    trackingNumber: document.getElementById('trackingNumber'),
    lastMileNumber: document.getElementById('lastMileNumber'),
    extractedAt: document.getElementById('extractedAt'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    helpBtn: document.getElementById('helpBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    notificationClose: document.getElementById('notificationClose'),
    // 設定関連
    settingsSection: document.getElementById('settingsSection'),
    historySection: document.getElementById('historySection'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    autoExtractEnabled: document.getElementById('autoExtractEnabled'),
    notificationEnabled: document.getElementById('notificationEnabled'),
    historyRetentionDays: document.getElementById('historyRetentionDays'),
    autoSaveEnabled: document.getElementById('autoSaveEnabled'),
    showButtonsOnSite: document.getElementById('showButtonsOnSite'),
    buttonPosition: document.getElementById('buttonPosition'),
    resetSettingsBtn: document.getElementById('resetSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn')
};

// 現在のデータを保存
let currentData = null;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup DOM loaded');
    
    // イベントリスナーを設定
    setupEventListeners();
    
    // 履歴を読み込み
    loadHistory();
    
    // 現在のタブがebayCPaSSサイトかチェック（初期状態は読み込み中）
    setTimeout(checkCurrentTab, 100); // 少し遅延させて確実に実行
});

// イベントリスナーの設定
function setupEventListeners() {
    // 抽出ボタン
    elements.extractBtn.addEventListener('click', handleExtract);
    
    // 保存ボタン
    elements.saveBtn.addEventListener('click', handleSave);
    
    // クリップボードコピーボタン
    elements.copyBtn.addEventListener('click', handleCopyToClipboard);
    
    // 全件コピーボタン
    elements.bulkCopyBtn.addEventListener('click', handleBulkCopyToClipboard);
    
    // 履歴クリアボタン
    elements.clearHistoryBtn.addEventListener('click', handleClearHistory);
    
    // 設定ボタン
    elements.settingsBtn.addEventListener('click', handleSettings);
    
    // ヘルプボタン
    elements.helpBtn.addEventListener('click', handleHelp);
    
    // 通知クローズボタン
    elements.notificationClose.addEventListener('click', hideNotification);
    
    // 設定関連
    elements.closeSettingsBtn.addEventListener('click', closeSettings);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.resetSettingsBtn.addEventListener('click', resetSettings);
}

// 現在のタブをチェック
function checkCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            console.error('Error querying tabs:', chrome.runtime.lastError.message);
            updateStatus('error');
            return;
        }
        
        const currentTab = tabs[0];
        if (!currentTab || !currentTab.url) {
            updateStatus('error');
            return;
        }
        
        console.log('Current tab URL:', currentTab.url);
        
        // ebayCPaSSサイトかどうかを詳細にチェック
        const isEbayCPaSSPage = currentTab.url.includes('ebaycpass.com') || 
                                currentTab.url.includes('ebay') && currentTab.url.includes('cpass');
        
        if (isEbayCPaSSPage) {
            updateStatus('ready');
            // コンテンツスクリプトが読み込まれているかテスト
            testContentScript(currentTab.id);
        } else {
            updateStatus('not_ebay');
        }
    });
}

// コンテンツスクリプトのテスト
function testContentScript(tabId) {
    chrome.tabs.sendMessage(tabId, {
        action: 'ping'
    }, function(response) {
        if (chrome.runtime.lastError) {
            console.log('Content script not ready:', chrome.runtime.lastError.message);
            // コンテンツスクリプトが読み込まれていない場合は警告を表示
            updateStatus('ready'); // 基本的には準備完了とする
        } else {
            console.log('Content script is ready');
            
            // APIエラーの状態をチェック
            if (response && response.apiErrorDetected) {
                updateStatus('api_error');
            } else {
                updateStatus('ready');
            }
        }
    });
}

// ステータスを更新
function updateStatus(status = 'ready') {
    const statusDot = elements.statusIndicator.querySelector('.status-dot');
    
    // 既存のクラスを削除
    statusDot.classList.remove('error', 'warning', 'success');
    
    switch (status) {
        case 'ready':
            elements.statusText.textContent = '準備完了 - データ抽出可能';
            statusDot.classList.add('success');
            elements.extractBtn.disabled = false;
            break;
        case 'not_ebay':
            elements.statusText.textContent = 'ebayCPaSSサイトを開いてください';
            statusDot.classList.add('warning');
            elements.extractBtn.disabled = true;
            break;
        case 'extracting':
            elements.statusText.textContent = 'データを抽出中...';
            statusDot.classList.add('warning');
            elements.extractBtn.disabled = true;
            break;
        case 'error':
            elements.statusText.textContent = 'エラーが発生しました';
            statusDot.classList.add('error');
            elements.extractBtn.disabled = false;
            break;
        case 'content_script_not_ready':
            elements.statusText.textContent = 'ページを再読み込みしてください';
            statusDot.classList.add('warning');
            elements.extractBtn.disabled = true;
            break;
        case 'api_error':
            elements.statusText.textContent = '⚠️ APIエラー検出 - 抽出可能だが不完全な可能性';
            statusDot.classList.add('warning');
            elements.extractBtn.disabled = false;
            break;
        case 'injecting':
            elements.statusText.textContent = 'コンテンツスクリプトを注入中...';
            statusDot.classList.add('warning');
            elements.extractBtn.disabled = true;
            break;
        case 'retrying':
            elements.statusText.textContent = 'データ抽出を再試行中...';
            statusDot.classList.add('warning');
            elements.extractBtn.disabled = true;
            break;
        default:
            elements.statusText.textContent = '準備完了';
            elements.extractBtn.disabled = false;
    }
}

// データ抽出処理
function handleExtract() {
    console.log('Extract button clicked');
    
    updateStatus('extracting');
    showLoading(true);
    
    // 現在のタブに対してデータ抽出を実行
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
            console.error('Error querying tabs:', chrome.runtime.lastError.message);
            handleExtractError('タブの取得に失敗しました: ' + chrome.runtime.lastError.message);
            return;
        }
        
        const currentTab = tabs[0];
        if (!currentTab) {
            handleExtractError('アクティブなタブが見つかりません');
            return;
        }
        
        console.log('Sending message to tab:', currentTab.id, currentTab.url);
        
        // コンテンツスクリプトにメッセージを送信
        chrome.tabs.sendMessage(currentTab.id, {
            action: 'extractData'
        }, function(response) {
            showLoading(false);
            
            if (chrome.runtime.lastError) {
                console.error('Error sending message:', chrome.runtime.lastError.message);
                const errorMsg = chrome.runtime.lastError.message;
                
                if (errorMsg.includes('Could not establish connection')) {
                    console.log('Content script not found, attempting to inject...');
                    // コンテンツスクリプトを再注入してから再試行
                    injectContentScriptAndRetry(currentTab.id);
                } else {
                    handleExtractError('データ抽出に失敗しました: ' + errorMsg);
                }
                return;
            }
            
            console.log('Received response:', response);
            
            if (response && response.success) {
                handleExtractSuccess(response.data);
            } else {
                handleExtractError(response ? response.error : '不明なエラーが発生しました');
            }
        });
    });
}

// コンテンツスクリプトを再注入してから再試行
function injectContentScriptAndRetry(tabId) {
    console.log('Injecting content script into tab:', tabId);
    updateStatus('injecting');
    
    // コンテンツスクリプトとCSSを注入
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content/content.js']
    }, function() {
        if (chrome.runtime.lastError) {
            console.error('Failed to inject content script:', chrome.runtime.lastError.message);
            handleExtractError('コンテンツスクリプトの注入に失敗しました。ページを再読み込みしてください。');
            updateStatus('error');
            return;
        }
        
        // CSSも注入
        chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ['src/content/content.css']
        }, function() {
            if (chrome.runtime.lastError) {
                console.warn('Failed to inject CSS:', chrome.runtime.lastError.message);
                // CSSの注入に失敗してもスクリプトは動作するので続行
            }
            
            console.log('Content script injected successfully, retrying extraction...');
            updateStatus('retrying');
            
            // 少し待ってから再試行（コンテンツスクリプトの初期化を待つ）
            setTimeout(function() {
                retryExtraction(tabId);
            }, 1500);
        });
    });
}

// データ抽出を再試行
function retryExtraction(tabId) {
    console.log('Retrying data extraction...');
    
    chrome.tabs.sendMessage(tabId, {
        action: 'extractData'
    }, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Retry failed:', chrome.runtime.lastError.message);
            handleExtractError('データ抽出に失敗しました。ページを再読み込みしてください。');
            updateStatus('error');
            return;
        }
        
        console.log('Retry successful:', response);
        
        if (response && response.success) {
            handleExtractSuccess(response.data);
        } else {
            handleExtractError(response ? response.error : '不明なエラーが発生しました');
        }
    });
}

// データ抽出成功時の処理
function handleExtractSuccess(data) {
    console.log('Extract success:', data);
    
    currentData = data;
    
    // データを表示
    displayExtractedData(data);
    
    // ステータスを更新（APIエラーの状態も考慮）
    if (data.apiErrorDetected) {
        updateStatus('api_error');
    } else {
        updateStatus('ready');
    }
    
    // ボタンを有効化
    elements.saveBtn.disabled = false;
    elements.copyBtn.disabled = false;
    
    // 通知を表示
    const hasData = data.estimatedShippingCost || data.trackingNumber || data.lastMileTrackingNumber;
    let message = hasData ? 'データを抽出しました' : 'データが見つかりませんでした';
    let type = hasData ? 'success' : 'error';
    
    // APIエラーが検出されている場合の追加メッセージ
    if (data.apiErrorDetected) {
        message += ' (APIエラーが検出されています)';
        if (hasData) {
            type = 'warning';
        }
    }
    
    showNotification(message, type);
    
    // 履歴を更新
    addToHistory(data);
}

// データ抽出エラー時の処理
function handleExtractError(error) {
    console.error('Extract error:', error);
    
    updateStatus('error');
    
    // 通知を表示
    showNotification('データ抽出に失敗しました: ' + error, 'error');
}

// 抽出データを表示
function displayExtractedData(data) {
    // データセクションを表示
    elements.dataSection.style.display = 'block';
    
    // 各フィールドを更新
    elements.shippingCost.textContent = data.estimatedShippingCost || '-';
    elements.trackingNumber.textContent = data.trackingNumber || '-';
    elements.lastMileNumber.textContent = data.lastMileTrackingNumber || '-';
    
    // 抽出日時を表示
    const extractedAt = new Date(data.extractedAt || Date.now());
    elements.extractedAt.textContent = extractedAt.toLocaleString('ja-JP');
    
    // ハイライト効果
    const dataValues = elements.dataSection.querySelectorAll('.data-value');
    dataValues.forEach(function(element) {
        if (element.textContent !== '-') {
            element.classList.add('highlight');
        } else {
            element.classList.remove('highlight');
        }
    });
}

// Google Sheetsに保存
function handleSave() {
    console.log('Save button clicked');
    
    if (!currentData) {
        showNotification('保存するデータがありません', 'error');
        return;
    }
    
    showLoading(true);
    elements.saveBtn.disabled = true;
    
    // バックグラウンドスクリプトに保存を依頼
    chrome.runtime.sendMessage({
        action: 'saveToSheets',
        data: currentData
    }, function(response) {
        showLoading(false);
        elements.saveBtn.disabled = false;
        
        if (chrome.runtime.lastError) {
            console.error('Error sending save message:', chrome.runtime.lastError.message);
            showNotification('保存に失敗しました', 'error');
            return;
        }
        
        if (response && response.success) {
            if (response.fallback) {
                // フォールバック（ローカル保存）の場合
                showNotification(response.message, 'warning');
                
                // Google Sheets設定を提案
                setTimeout(() => {
                    if (confirm('Google Sheets APIが設定されていません。\n設定ページを開いて設定しますか？')) {
                        chrome.runtime.openOptionsPage();
                    }
                }, 2000);
            } else {
                // Google Sheets保存成功
                showNotification(response.message, 'success');
                
                // スプレッドシートを開くオプション
                if (response.spreadsheetId) {
                    setTimeout(() => {
                        if (confirm('保存されたGoogle Sheetsを開きますか？')) {
                            chrome.tabs.create({
                                url: `https://docs.google.com/spreadsheets/d/${response.spreadsheetId}/edit`
                            });
                        }
                    }, 1000);
                }
            }
        } else {
            const errorMessage = response ? response.error : '不明なエラー';
            showNotification('保存に失敗しました: ' + errorMessage, 'error');
        }
    });
}

// 履歴を読み込み
function loadHistory() {
    chrome.runtime.sendMessage({
        action: 'getExtractedData'
    }, function(response) {
        if (chrome.runtime.lastError) {
            console.error('Error loading history:', chrome.runtime.lastError.message);
            return;
        }
        
        if (response && response.success) {
            displayHistory(response.data);
        }
    });
}

// 履歴を表示
function displayHistory(historyData) {
    if (!historyData || historyData.length === 0) {
        elements.historyList.innerHTML = '<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg><p>まだ抽出データがありません</p></div>';
        return;
    }
    
    // 最新のデータから表示
    const sortedData = historyData.sort(function(a, b) {
        return new Date(b.extractedAt) - new Date(a.extractedAt);
    });
    
    const historyHTML = sortedData.map(function(item) {
        const date = new Date(item.extractedAt);
        const hasData = item.estimatedShippingCost || item.trackingNumber || item.lastMileTrackingNumber;
        
        return '<div class="history-item" data-id="' + item.id + '">' +
               '<div class="history-meta">' +
               '<span class="history-date">' + date.toLocaleString('ja-JP') + '</span>' +
               '<span class="history-status ' + (hasData ? 'success' : 'error') + '">' +
               (hasData ? '成功' : '失敗') + '</span>' +
               '</div>' +
               '<div class="history-data">' +
               '送料: ' + (item.estimatedShippingCost || '-') + ' | ' +
               '追跡: ' + (item.trackingNumber || '-') +
               '</div>' +
               '</div>';
    }).join('');
    
    elements.historyList.innerHTML = historyHTML;
    
    // 履歴アイテムのクリックイベントを設定
    const historyItems = elements.historyList.querySelectorAll('.history-item');
    historyItems.forEach(function(item) {
        item.addEventListener('click', function() {
            const itemId = this.getAttribute('data-id');
            const itemData = historyData.find(function(data) {
                return data.id === itemId;
            });
            if (itemData) {
                currentData = itemData;
                displayExtractedData(itemData);
                elements.saveBtn.disabled = false;
                elements.copyBtn.disabled = false;
            }
        });
    });
}

// 履歴に追加
function addToHistory(data) {
    // 履歴を再読み込み
    setTimeout(loadHistory, 500);
}

// 履歴をクリア
function handleClearHistory() {
    if (confirm('履歴をすべて削除しますか？')) {
        chrome.storage.local.clear(function() {
            if (chrome.runtime.lastError) {
                console.error('Error clearing history:', chrome.runtime.lastError.message);
                showNotification('履歴の削除に失敗しました', 'error');
            } else {
                loadHistory();
                showNotification('履歴を削除しました', 'success');
            }
        });
    }
}

// クリップボードにコピー
function handleCopyToClipboard() {
    console.log('Copy button clicked');
    
    if (!currentData) {
        showNotification('コピーするデータがありません', 'error');
        return;
    }
    
    // データをタブ区切りテキストとして整形
    const copyText = formatDataForClipboard(currentData);
    
    // クリップボードにコピー
    navigator.clipboard.writeText(copyText).then(function() {
        showNotification('データをクリップボードにコピーしました', 'success');
    }).catch(function(err) {
        console.error('Failed to copy to clipboard:', err);
        
        // フォールバック: テキストエリアを使用
        const textArea = document.createElement('textarea');
        textArea.value = copyText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            showNotification('データをクリップボードにコピーしました', 'success');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            showNotification('クリップボードへのコピーに失敗しました', 'error');
        }
        
        document.body.removeChild(textArea);
    });
}

// データをクリップボード用に整形
function formatDataForClipboard(data) {
    const date = new Date(data.extractedAt || Date.now());
    const dateString = date.toLocaleString('ja-JP');
    
    // タブ区切りテキスト（Excel/Google Sheetsに貼り付け可能）
    const tabSeparated = [
        dateString,
        data.estimatedShippingCost || '',
        data.trackingNumber || '',
        data.lastMileTrackingNumber || '',
        data.pageUrl || '',
        data.extractionStatus || '成功'
    ].join('\t');
    
    // 見やすいテキスト版も追加
    const readable = `
抽出日時: ${dateString}
推定送料: ${data.estimatedShippingCost || '-'}
追跡番号: ${data.trackingNumber || '-'}
ラストマイル追跡番号: ${data.lastMileTrackingNumber || '-'}
ページURL: ${data.pageUrl || '-'}
抽出ステータス: ${data.extractionStatus || '成功'}
`;
    
    // タブ区切り形式を優先（スプレッドシートへの貼り付け用）
    return tabSeparated + '\n\n' + readable;
}

// 設定を開く
function handleSettings() {
    elements.settingsSection.style.display = 'block';
    elements.historySection.style.display = 'none';
    loadSettings();
}

// ヘルプを開く
function handleHelp() {
    chrome.tabs.create({
        url: 'https://github.com/make-it-at/EbayCPaSS2GoogleSheets'
    });
}

// 全件コピー機能
function handleBulkCopyToClipboard() {
    console.log('Bulk copy button clicked');
    
    chrome.storage.local.get(null, function(items) {
        if (chrome.runtime.lastError) {
            console.error('Error loading history:', chrome.runtime.lastError.message);
            showNotification('履歴の読み込みに失敗しました', 'error');
            return;
        }
        
        const historyData = [];
        Object.keys(items).forEach(key => {
            if (key.startsWith('extract_')) {
                const data = items[key];
                historyData.push({
                    extractedAt: data.extractedAt,
                    estimatedShippingCost: data.estimatedShippingCost,
                    trackingNumber: data.trackingNumber,
                    lastMileTrackingNumber: data.lastMileTrackingNumber,
                    pageUrl: data.pageUrl,
                    extractionStatus: data.extractionStatus
                });
            }
        });
        
        if (historyData.length === 0) {
            showNotification('コピーするデータがありません', 'warning');
            return;
        }
        
        // 日付順にソート（新しい順）
        historyData.sort((a, b) => new Date(b.extractedAt) - new Date(a.extractedAt));
        
        // タブ区切り形式（スプレッドシート用）
        const header = '抽出日時\t推定送料\t追跡番号\tラストマイル追跡番号\tページURL\t抽出ステータス';
        const tabDelimitedData = historyData.map(item => {
            return [
                item.extractedAt,
                item.estimatedShippingCost || '',
                item.trackingNumber || '',
                item.lastMileTrackingNumber || '',
                item.pageUrl || '',
                item.extractionStatus || '成功'
            ].join('\t');
        }).join('\n');
        
        const tabDelimitedText = header + '\n' + tabDelimitedData;
        
        // クリップボードにコピー
        navigator.clipboard.writeText(tabDelimitedText).then(function() {
            showNotification(`全${historyData.length}件のデータをクリップボードにコピーしました`, 'success');
        }).catch(function(err) {
            console.error('Copy failed:', err);
            
            // フォールバック: テキストエリアを使用
            const textArea = document.createElement('textarea');
            textArea.value = tabDelimitedText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                showNotification(`全${historyData.length}件のデータをクリップボードにコピーしました`, 'success');
            } catch (err) {
                console.error('Fallback copy failed:', err);
                showNotification('クリップボードへのコピーに失敗しました', 'error');
            }
            
            document.body.removeChild(textArea);
        });
    });
}

// ローディング表示
function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

// 通知を表示
function showNotification(message, type = 'info') {
    elements.notificationMessage.textContent = message;
    elements.notification.className = 'notification ' + type;
    elements.notification.style.display = 'block';
    
    // 3秒後に自動で非表示
    setTimeout(hideNotification, 3000);
}

// 通知を非表示
function hideNotification() {
    elements.notification.style.display = 'none';
}

// 設定を閉じる
function closeSettings() {
    elements.settingsSection.style.display = 'none';
    elements.historySection.style.display = 'block';
}

// 設定を読み込み
function loadSettings() {
    chrome.storage.sync.get({
        autoExtractEnabled: false,
        notificationEnabled: true,
        historyRetentionDays: 30,
        autoSaveEnabled: false,
        showButtonsOnSite: true,
        buttonPosition: 'top-right'
    }, function(settings) {
        if (chrome.runtime.lastError) {
            console.error('Error loading settings:', chrome.runtime.lastError.message);
            return;
        }
        
        elements.autoExtractEnabled.checked = settings.autoExtractEnabled;
        elements.notificationEnabled.checked = settings.notificationEnabled;
        elements.historyRetentionDays.value = settings.historyRetentionDays;
        elements.autoSaveEnabled.checked = settings.autoSaveEnabled;
        elements.showButtonsOnSite.checked = settings.showButtonsOnSite;
        elements.buttonPosition.value = settings.buttonPosition;
    });
}

// 設定を保存
function saveSettings() {
    const settings = {
        autoExtractEnabled: elements.autoExtractEnabled.checked,
        notificationEnabled: elements.notificationEnabled.checked,
        historyRetentionDays: parseInt(elements.historyRetentionDays.value),
        autoSaveEnabled: elements.autoSaveEnabled.checked,
        showButtonsOnSite: elements.showButtonsOnSite.checked,
        buttonPosition: elements.buttonPosition.value
    };
    
    chrome.storage.sync.set(settings, function() {
        if (chrome.runtime.lastError) {
            console.error('Error saving settings:', chrome.runtime.lastError.message);
            showNotification('設定の保存に失敗しました', 'error');
            return;
        }
        
        showNotification('設定を保存しました', 'success');
        
        // コンテンツスクリプトに設定変更を通知
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSettings',
                    settings: settings
                });
            }
        });
    });
}

// 設定をリセット
function resetSettings() {
    if (confirm('設定をデフォルト値にリセットしますか？')) {
        const defaultSettings = {
            autoExtractEnabled: false,
            notificationEnabled: true,
            historyRetentionDays: 30,
            autoSaveEnabled: false,
            showButtonsOnSite: true,
            buttonPosition: 'top-right'
        };
        
        chrome.storage.sync.set(defaultSettings, function() {
            if (chrome.runtime.lastError) {
                console.error('Error resetting settings:', chrome.runtime.lastError.message);
                showNotification('設定のリセットに失敗しました', 'error');
                return;
            }
            
            loadSettings();
            showNotification('設定をリセットしました', 'success');
        });
    }
}

console.log('ebayCPaSS2GoogleSheets popup initialized'); 