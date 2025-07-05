// ebayCPaSS2GoogleSheets Options Page JavaScript

console.log('ebayCPaSS2GoogleSheets options page loaded');

// DOM要素を取得
const elements = {
    // 抽出設定
    autoExtract: document.getElementById('autoExtract'),
    saveToSheets: document.getElementById('saveToSheets'),
    showNotifications: document.getElementById('showNotifications'),
    showButtonsOnSite: document.getElementById('showButtonsOnSite'),
    buttonPosition: document.getElementById('buttonPosition'),
    buttonMode: document.getElementById('buttonMode'),
    historyRetentionDays: document.getElementById('historyRetentionDays'),
    
    // OAuth認証
    oauthStatus: document.getElementById('oauthStatus'),
    oauthIcon: document.getElementById('oauthIcon'),
    oauthTitle: document.getElementById('oauthTitle'),
    oauthDescription: document.getElementById('oauthDescription'),
    oauthButton: document.getElementById('oauthButton'),
    clientId: document.getElementById('clientId'),
    validateClientId: document.getElementById('validateClientId'),
    copyRedirectUri: document.getElementById('copyRedirectUri'),
    showClientIdHelp: document.getElementById('showClientIdHelp'),
    clientIdHelp: document.getElementById('clientIdHelp'),
    extensionId: document.getElementById('extensionId'),
    
    // Google Sheets設定
    spreadsheetId: document.getElementById('spreadsheetId'),
    sheetName: document.getElementById('sheetName'),
    createNewSheet: document.getElementById('createNewSheet'),
    openSheet: document.getElementById('openSheet'),
    testConnection: document.getElementById('testConnection'),
    
    // データ抽出設定
    shippingCostSelector: document.getElementById('shippingCostSelector'),
    trackingNumberSelector: document.getElementById('trackingNumberSelector'),
    lastMileSelector: document.getElementById('lastMileSelector'),
    resetSelectors: document.getElementById('resetSelectors'),
    
    // データ管理
    exportData: document.getElementById('exportData'),
    clearAllData: document.getElementById('clearAllData'),
    
    // その他
    saveSettings: document.getElementById('saveSettings'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    notificationClose: document.getElementById('notificationClose')
};

// デフォルト設定
const defaultSettings = {
    extractionSettings: {
        autoExtract: false,
        saveToSheets: true,
        showNotifications: true,
        showButtonsOnSite: true,
        buttonPosition: 'top-right',
        buttonMode: 'individual',
        historyRetentionDays: 30
    },
    sheetsConfig: {
        spreadsheetId: '',
        sheetName: 'ebayCPaSS抽出データ'
    },
    selectors: {
        estimatedShippingCost: 'div span.value',
        trackingNumber: 'a span',
        lastMileTrackingNumber: 'span.bold'
    },
    oauthConfig: {
        clientId: '',
        accessToken: '',
        refreshToken: '',
        authenticated: false
    }
};

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Options page DOM loaded');
    
    // 拡張機能IDを表示
    if (elements.extensionId) {
        elements.extensionId.textContent = chrome.runtime.id;
    }
    
    // イベントリスナーを設定
    setupEventListeners();
    
    // 設定を読み込み
    loadSettings();
    
    // OAuth認証状態を確認
    checkOAuthStatus();
});

// イベントリスナーの設定
function setupEventListeners() {
    // 設定保存ボタン
    elements.saveSettings.addEventListener('click', saveSettings);
    
    // OAuth認証関連
    elements.oauthButton.addEventListener('click', handleOAuthAction);
    elements.clientId.addEventListener('input', handleClientIdChange);
    elements.validateClientId.addEventListener('click', validateClientId);
    elements.copyRedirectUri.addEventListener('click', copyRedirectUri);
    if (elements.showClientIdHelp) {
        elements.showClientIdHelp.addEventListener('click', function(e) {
            e.preventDefault();
            const helpSection = elements.clientIdHelp;
            helpSection.style.display = helpSection.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    // Google Sheets関連
    elements.createNewSheet.addEventListener('click', createNewSpreadsheet);
    elements.openSheet.addEventListener('click', openSpreadsheet);
    elements.testConnection.addEventListener('click', testConnection);
    
    // セレクターリセット
    elements.resetSelectors.addEventListener('click', resetSelectors);
    
    // データ管理
    elements.exportData.addEventListener('click', exportData);
    elements.clearAllData.addEventListener('click', clearAllData);
    
    // 通知クローズ
    elements.notificationClose.addEventListener('click', hideNotification);
    
    // スプレッドシートIDの変更を監視
    elements.spreadsheetId.addEventListener('input', function() {
        const hasId = this.value.trim() !== '';
        elements.openSheet.disabled = !hasId;
    });
    
    // サイト上のボタン表示設定の変更を監視
    elements.showButtonsOnSite.addEventListener('change', saveSettings);
    elements.buttonPosition.addEventListener('change', saveSettings);
    elements.buttonMode.addEventListener('change', saveSettings);
    elements.historyRetentionDays.addEventListener('change', saveSettings);
}

// 設定を読み込み
function loadSettings() {
    console.log('Loading settings...');
    
    chrome.storage.sync.get([
        'extractionSettings',
        'sheetsConfig',
        'selectors',
        'oauthConfig'
    ], function(result) {
        if (chrome.runtime.lastError) {
            console.error('Error loading settings:', chrome.runtime.lastError.message);
            showNotification('設定の読み込みに失敗しました', 'error');
            return;
        }
        
        // 抽出設定
        const extractionSettings = result.extractionSettings || defaultSettings.extractionSettings;
        elements.autoExtract.checked = extractionSettings.autoExtract;
        elements.saveToSheets.checked = extractionSettings.saveToSheets;
        elements.showNotifications.checked = extractionSettings.showNotifications;
        elements.showButtonsOnSite.checked = extractionSettings.showButtonsOnSite !== false; // デフォルトtrue
        elements.buttonPosition.value = extractionSettings.buttonPosition || defaultSettings.extractionSettings.buttonPosition;
        elements.buttonMode.value = extractionSettings.buttonMode || defaultSettings.extractionSettings.buttonMode;
        elements.historyRetentionDays.value = extractionSettings.historyRetentionDays || defaultSettings.extractionSettings.historyRetentionDays;
        
        // OAuth設定
        const oauthConfig = result.oauthConfig || defaultSettings.oauthConfig;
        elements.clientId.value = oauthConfig.clientId || '';
        
        // Google Sheets設定
        const sheetsConfig = result.sheetsConfig || defaultSettings.sheetsConfig;
        elements.spreadsheetId.value = sheetsConfig.spreadsheetId || '';
        elements.sheetName.value = sheetsConfig.sheetName || defaultSettings.sheetsConfig.sheetName;
        
        // スプレッドシートを開くボタンの状態を更新
        elements.openSheet.disabled = !sheetsConfig.spreadsheetId;
        
        // セレクター設定
        const selectors = result.selectors || defaultSettings.selectors;
        elements.shippingCostSelector.value = selectors.estimatedShippingCost || defaultSettings.selectors.estimatedShippingCost;
        elements.trackingNumberSelector.value = selectors.trackingNumber || defaultSettings.selectors.trackingNumber;
        elements.lastMileSelector.value = selectors.lastMileTrackingNumber || defaultSettings.selectors.lastMileTrackingNumber;
        
        console.log('Settings loaded successfully');
    });
}

// 設定を保存
function saveSettings() {
    console.log('Saving settings...');
    
    const settings = {
        extractionSettings: {
            autoExtract: elements.autoExtract.checked,
            saveToSheets: elements.saveToSheets.checked,
            showNotifications: elements.showNotifications.checked,
            showButtonsOnSite: elements.showButtonsOnSite.checked,
            buttonPosition: elements.buttonPosition.value,
            buttonMode: elements.buttonMode.value,
            historyRetentionDays: parseInt(elements.historyRetentionDays.value)
        },
        sheetsConfig: {
            spreadsheetId: elements.spreadsheetId.value.trim(),
            sheetName: elements.sheetName.value.trim() || defaultSettings.sheetsConfig.sheetName
        },
        selectors: {
            estimatedShippingCost: elements.shippingCostSelector.value.trim() || defaultSettings.selectors.estimatedShippingCost,
            trackingNumber: elements.trackingNumberSelector.value.trim() || defaultSettings.selectors.trackingNumber,
            lastMileTrackingNumber: elements.lastMileSelector.value.trim() || defaultSettings.selectors.lastMileTrackingNumber
        }
    };
    
    // OAuth設定も保存（既存の設定を保持）
    chrome.storage.sync.get(['oauthConfig'], function(result) {
        const oauthConfig = result.oauthConfig || defaultSettings.oauthConfig;
        oauthConfig.clientId = elements.clientId.value.trim();
        
        settings.oauthConfig = oauthConfig;
        
        // すべての設定を保存
        chrome.storage.sync.set(settings, function() {
            if (chrome.runtime.lastError) {
                console.error('Error saving settings:', chrome.runtime.lastError.message);
                showNotification('設定の保存に失敗しました', 'error');
                return;
            }
            
            console.log('Settings saved successfully');
            showNotification('設定を保存しました', 'success');
            
            // コンテンツスクリプトに設定変更を通知
            chrome.tabs.query({url: "*://*.ebaycpass.com/*"}, function(tabs) {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'settingsUpdated',
                        settings: settings
                    });
                });
            });
        });
    });
}

// 新しいスプレッドシートを作成
function createNewSpreadsheet() {
    console.log('Creating new spreadsheet...');
    
    elements.createNewSheet.disabled = true;
    elements.createNewSheet.textContent = '作成中...';
    
    // バックグラウンドスクリプトに作成を依頼
    chrome.runtime.sendMessage({
        action: 'createNewSpreadsheet'
    }, function(response) {
        elements.createNewSheet.disabled = false;
        elements.createNewSheet.textContent = '新しいスプレッドシートを作成';
        
        if (chrome.runtime.lastError) {
            console.error('Error creating spreadsheet:', chrome.runtime.lastError.message);
            showNotification('スプレッドシートの作成に失敗しました', 'error');
            return;
        }
        
        if (response && response.success) {
            elements.spreadsheetId.value = response.spreadsheetId;
            elements.openSheet.disabled = false;
            showNotification('新しいスプレッドシートを作成しました', 'success');
        } else {
            const errorMessage = response ? response.error : '不明なエラー';
            showNotification('自動作成は現在利用できません。手動で作成してください。', 'error');
            
            // 手動作成の手順を表示
            setTimeout(() => {
                showManualCreationInstructions();
            }, 1000);
        }
    });
}

// スプレッドシートを開く
function openSpreadsheet() {
    const spreadsheetId = elements.spreadsheetId.value.trim();
    if (!spreadsheetId) {
        showNotification('スプレッドシートIDが設定されていません', 'error');
        return;
    }
    
    const url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit';
    chrome.tabs.create({ url: url });
}

// セレクターをデフォルトに戻す
function resetSelectors() {
    if (confirm('セレクターをデフォルト値に戻しますか？')) {
        elements.shippingCostSelector.value = defaultSettings.selectors.estimatedShippingCost;
        elements.trackingNumberSelector.value = defaultSettings.selectors.trackingNumber;
        elements.lastMileSelector.value = defaultSettings.selectors.lastMileTrackingNumber;
        showNotification('セレクターをデフォルト値に戻しました', 'info');
    }
}

// データをエクスポート
function exportData() {
    console.log('Exporting data...');
    
    chrome.storage.local.get(['extractedData'], function(result) {
        if (chrome.runtime.lastError) {
            console.error('Error getting data:', chrome.runtime.lastError.message);
            showNotification('データの取得に失敗しました', 'error');
            return;
        }
        
        const data = result.extractedData || [];
        if (data.length === 0) {
            showNotification('エクスポートするデータがありません', 'error');
            return;
        }
        
        // JSONファイルとしてダウンロード
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            data: data
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const filename = 'ebayCPaSS_data_' + new Date().toISOString().split('T')[0] + '.json';
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('データをエクスポートしました', 'success');
    });
}

// すべてのデータを削除
function clearAllData() {
    if (confirm('すべてのデータを削除しますか？この操作は元に戻せません。')) {
        chrome.storage.local.clear(function() {
            if (chrome.runtime.lastError) {
                console.error('Error clearing data:', chrome.runtime.lastError.message);
                showNotification('データの削除に失敗しました', 'error');
            } else {
                console.log('All data cleared');
                showNotification('すべてのデータを削除しました', 'success');
            }
        });
    }
}

// 通知を表示
function showNotification(message, type = 'info') {
    elements.notificationMessage.textContent = message;
    elements.notification.className = 'notification ' + type;
    elements.notification.style.display = 'block';
    
    // 5秒後に自動で非表示
    setTimeout(hideNotification, 5000);
}

// 通知を非表示
function hideNotification() {
    elements.notification.style.display = 'none';
}

// 手動作成の手順を表示
function showManualCreationInstructions() {
    const instructions = `
手動でスプレッドシートを作成する手順：

1. Google Sheetsを開く (https://sheets.google.com)
2. 新しいスプレッドシートを作成
3. 以下のヘッダー行を追加：
   A1: 抽出日時
   B1: 推定送料
   C1: 追跡番号
   D1: ラストマイル追跡番号
   E1: ページURL
   F1: 抽出ステータス
4. スプレッドシートのURLからIDをコピー
   (例: https://docs.google.com/spreadsheets/d/[このID部分]/edit)
5. 下記のスプレッドシートIDフィールドに貼り付け
    `;
    
    if (confirm(instructions + '\n\nGoogle Sheetsを開きますか？')) {
        chrome.tabs.create({ url: 'https://sheets.google.com' });
    }
}

// OAuth認証状態をチェック
function checkOAuthStatus() {
    chrome.storage.sync.get(['oauthConfig'], function(result) {
        const oauthConfig = result.oauthConfig || defaultSettings.oauthConfig;
        const hasClientId = oauthConfig.clientId && oauthConfig.clientId.trim() !== '';
        const isAuthenticated = oauthConfig.authenticated && oauthConfig.accessToken;
        
        updateOAuthUI(hasClientId, isAuthenticated);
        updateButtonStates(hasClientId, isAuthenticated);
    });
}

// OAuth UIを更新
function updateOAuthUI(hasClientId, isAuthenticated) {
    const status = elements.oauthStatus;
    const icon = elements.oauthIcon;
    const title = elements.oauthTitle;
    const description = elements.oauthDescription;
    const button = elements.oauthButton;
    
    // 既存のクラスを削除
    status.classList.remove('authenticated', 'error');
    
    if (isAuthenticated) {
        // 認証済み
        status.classList.add('authenticated');
        icon.textContent = '✅';
        title.textContent = 'Google認証済み';
        description.textContent = 'Google Sheetsへのアクセスが許可されています';
        button.textContent = '認証を解除';
        button.className = 'btn btn-secondary';
    } else if (hasClientId) {
        // Client IDは設定済みだが未認証
        icon.textContent = '🔐';
        title.textContent = 'Google認証を開始';
        description.textContent = 'Client IDが設定されています。認証を開始してください';
        button.textContent = 'Google認証を開始';
        button.className = 'btn btn-primary';
    } else {
        // Client ID未設定
        status.classList.add('error');
        icon.textContent = '⚠️';
        title.textContent = 'Google Client IDが必要です';
        description.textContent = 'まずGoogle Cloud ConsoleでClient IDを取得してください';
        button.textContent = 'Client IDを設定';
        button.className = 'btn btn-secondary';
        button.disabled = true;
    }
}

// ボタンの状態を更新
function updateButtonStates(hasClientId, isAuthenticated) {
    const canUseGoogleSheets = hasClientId && isAuthenticated;
    
    elements.createNewSheet.disabled = !canUseGoogleSheets;
    elements.testConnection.disabled = !canUseGoogleSheets;
    
    // ボタンテキストも更新
    if (!canUseGoogleSheets) {
        elements.createNewSheet.textContent = '新しいスプレッドシートを作成（認証が必要）';
        elements.testConnection.textContent = '接続テスト（認証が必要）';
    } else {
        elements.createNewSheet.textContent = '新しいスプレッドシートを作成';
        elements.testConnection.textContent = '接続テスト';
    }
}

// OAuth認証アクションを処理
function handleOAuthAction() {
    chrome.storage.sync.get(['oauthConfig'], function(result) {
        const oauthConfig = result.oauthConfig || defaultSettings.oauthConfig;
        const hasClientId = oauthConfig.clientId && oauthConfig.clientId.trim() !== '';
        const isAuthenticated = oauthConfig.authenticated && oauthConfig.accessToken;
        
        if (isAuthenticated) {
            // 認証解除
            revokeOAuth();
        } else if (hasClientId) {
            // 認証開始
            startOAuth();
        } else {
            // Client ID設定を促す
            showNotification('まずGoogle Client IDを入力してください', 'error');
            elements.clientId.focus();
        }
    });
}

// OAuth認証を開始
function startOAuth() {
    console.log('Starting OAuth authentication...');
    
    elements.oauthButton.disabled = true;
    elements.oauthButton.textContent = '認証中...';
    
    chrome.storage.sync.get(['oauthConfig'], function(result) {
        const oauthConfig = result.oauthConfig || defaultSettings.oauthConfig;
        const clientId = oauthConfig.clientId;
        
        if (!clientId) {
            showNotification('Client IDが設定されていません', 'error');
            elements.oauthButton.disabled = false;
            elements.oauthButton.textContent = 'Google認証を開始';
            return;
        }
        
        // バックグラウンドスクリプトに認証を依頼
        chrome.runtime.sendMessage({
            action: 'startOAuth',
            clientId: clientId
        }, function(response) {
            elements.oauthButton.disabled = false;
            
            if (chrome.runtime.lastError) {
                console.error('OAuth error:', chrome.runtime.lastError.message);
                showNotification('認証に失敗しました', 'error');
                elements.oauthButton.textContent = 'Google認証を開始';
                return;
            }
            
            if (response && response.success) {
                showNotification('Google認証が完了しました', 'success');
                checkOAuthStatus();
            } else {
                const errorMessage = response ? response.error : '不明なエラー';
                showNotification(`認証に失敗しました: ${errorMessage}`, 'error');
                elements.oauthButton.textContent = 'Google認証を開始';
            }
        });
    });
}

// OAuth認証を解除
function revokeOAuth() {
    console.log('Revoking OAuth authentication...');
    
    elements.oauthButton.disabled = true;
    elements.oauthButton.textContent = '解除中...';
    
    chrome.runtime.sendMessage({
        action: 'revokeOAuth'
    }, function(response) {
        elements.oauthButton.disabled = false;
        
        if (chrome.runtime.lastError) {
            console.error('OAuth revoke error:', chrome.runtime.lastError.message);
            showNotification('認証解除に失敗しました', 'error');
            elements.oauthButton.textContent = '認証を解除';
            return;
        }
        
        if (response && response.success) {
            showNotification('Google認証を解除しました', 'success');
            checkOAuthStatus();
        } else {
            const errorMessage = response ? response.error : '不明なエラー';
            showNotification(`認証解除に失敗しました: ${errorMessage}`, 'error');
            elements.oauthButton.textContent = '認証を解除';
        }
    });
}

// Client ID変更時の処理
function handleClientIdChange() {
    const clientId = elements.clientId.value.trim();
    const isValid = clientId && clientId.includes('.apps.googleusercontent.com');
    
    if (isValid) {
        elements.clientId.style.borderColor = '#4caf50';
        elements.oauthButton.disabled = false;
        elements.oauthButton.textContent = 'Google認証を開始';
    } else {
        elements.clientId.style.borderColor = '#f44336';
        elements.oauthButton.disabled = true;
        elements.oauthButton.textContent = 'Client IDを設定';
    }
}

// 接続テスト
function testConnection() {
    console.log('Testing Google Sheets connection...');
    
    elements.testConnection.disabled = true;
    elements.testConnection.textContent = 'テスト中...';
    
    chrome.runtime.sendMessage({
        action: 'testConnection'
    }, function(response) {
        elements.testConnection.disabled = false;
        elements.testConnection.textContent = '接続テスト';
        
        if (chrome.runtime.lastError) {
            console.error('Connection test error:', chrome.runtime.lastError.message);
            showNotification('接続テストに失敗しました', 'error');
            return;
        }
        
        if (response && response.success) {
            showNotification('Google Sheets APIの接続に成功しました', 'success');
        } else {
            const errorMessage = response ? response.error : '不明なエラー';
            showNotification(`接続テストに失敗しました: ${errorMessage}`, 'error');
        }
    });
}

// Client IDを検証
function validateClientId() {
    const clientId = elements.clientId.value.trim();
    
    if (!clientId) {
        showNotification('Client IDを入力してください', 'error');
        return;
    }
    
    // Client IDの形式をチェック
    const clientIdPattern = /^[0-9]+-[a-zA-Z0-9]+\.apps\.googleusercontent\.com$/;
    if (!clientIdPattern.test(clientId)) {
        showNotification('Client IDの形式が正しくありません', 'error');
        return;
    }
    
    // 設定を保存
    chrome.storage.sync.get(['oauthConfig'], function(result) {
        const oauthConfig = result.oauthConfig || defaultSettings.oauthConfig;
        oauthConfig.clientId = clientId;
        
        chrome.storage.sync.set({ oauthConfig: oauthConfig }, function() {
            if (chrome.runtime.lastError) {
                showNotification('Client IDの保存に失敗しました', 'error');
                return;
            }
            
            showNotification('Client IDが正常に保存されました！', 'success');
            checkOAuthStatus();
        });
    });
}

// リダイレクトURIをコピー
function copyRedirectUri() {
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
    
    // クリップボードにコピー
    navigator.clipboard.writeText(redirectUri).then(function() {
        showNotification('リダイレクトURIをコピーしました！', 'success');
    }).catch(function(err) {
        console.error('Failed to copy redirect URI:', err);
        
        // フォールバック: テキストエリアを使用
        const textArea = document.createElement('textarea');
        textArea.value = redirectUri;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showNotification('リダイレクトURIをコピーしました！', 'success');
    });
}

console.log('ebayCPaSS2GoogleSheets options page initialized'); 