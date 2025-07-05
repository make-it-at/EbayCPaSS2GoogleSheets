// ebayCPaSS2GoogleSheets Background Service Worker
// Chrome Extension Manifest V3 対応

console.log('ebayCPaSS2GoogleSheets background service worker loaded');

// 拡張機能のインストール時
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // 初回インストール時の処理
    console.log('First time installation');
    
    // デフォルト設定を保存
    chrome.storage.sync.set({
      'extractionSettings': {
        'autoExtract': false,
        'saveToSheets': true,
        'showNotifications': true
      },
      'sheetsConfig': {
        'spreadsheetId': null,
        'sheetName': 'ebayCPaSS抽出データ'
      }
    });
  }
});

// コンテンツスクリプトからのメッセージを処理
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);
  
  if (request.action === 'dataExtracted') {
    // 抽出されたデータを処理
    handleExtractedData(request.data, sender.tab)
      .then(result => {
        sendResponse({success: true, result: result});
      })
      .catch(error => {
        console.error('Error handling extracted data:', error);
        sendResponse({success: false, error: error.message});
      });
    
    return true; // 非同期レスポンスを示す
  }
  
  if (request.action === 'saveToSheets') {
    // 現在はローカル保存のみ（Google Sheets APIは未設定）
    saveDataLocally(request.data)
      .then(result => {
        sendResponse({
          success: true, 
          result: result,
          message: 'データをローカルに保存しました。CSV形式でエクスポートしてGoogle Sheetsに手動で追加してください。'
        });
      })
      .catch(error => {
        console.error('Error saving data locally:', error);
        sendResponse({success: false, error: error.message});
      });
    
    return true;
  }
  
  if (request.action === 'getExtractedData') {
    // 保存されたデータを取得
    getStoredData()
      .then(data => {
        sendResponse({success: true, data: data});
      })
      .catch(error => {
        console.error('Error getting stored data:', error);
        sendResponse({success: false, error: error.message});
      });
    
    return true;
  }
  
  if (request.action === 'createNewSpreadsheet') {
    // OAuth2認証が設定されていないため、手動でスプレッドシートを作成する必要があります
    sendResponse({
      success: false, 
      error: 'Google Sheets APIの認証が必要です。手動でスプレッドシートを作成し、IDを入力してください。'
    });
    
    return true;
  }
  
  if (request.action === 'startOAuth') {
    // OAuth認証を開始
    startOAuthFlow(request.clientId)
      .then(result => {
        sendResponse({ success: true, token: result.token });
      })
      .catch(error => {
        console.error('OAuth error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  if (request.action === 'revokeOAuth') {
    // OAuth認証を解除
    revokeOAuthToken()
      .then(result => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('OAuth revoke error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  if (request.action === 'testConnection') {
    // 接続テスト
    testGoogleSheetsConnection()
      .then(result => {
        sendResponse({ success: true, result: result });
      })
      .catch(error => {
        console.error('Connection test error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

// 抽出データの処理
async function handleExtractedData(data, tab) {
  console.log('Handling extracted data:', data);
  
  try {
    // データをローカルストレージに保存
    await saveDataLocally(data);
    
    // 設定を取得
    const settings = await getSettings();
    
    // Google Sheetsに自動保存が有効な場合
    if (settings.extractionSettings.saveToSheets) {
      await saveToGoogleSheets(data);
    }
    
    // 通知を表示
    if (settings.extractionSettings.showNotifications) {
      showNotification(data);
    }
    
    return {
      message: 'Data processed successfully',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error in handleExtractedData:', error);
    throw error;
  }
}

// データをローカルストレージに保存
async function saveDataLocally(data) {
  return new Promise((resolve, reject) => {
    // 既存のデータを取得
    chrome.storage.local.get(['extractedData'], function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
        return;
      }
      
      const existingData = result.extractedData || [];
      
      // 新しいデータを追加
      const newData = {
        ...data,
        id: Date.now().toString(),
        savedAt: new Date().toISOString()
      };
      
      existingData.push(newData);
      
      // 最新の100件のみ保持
      if (existingData.length > 100) {
        existingData.splice(0, existingData.length - 100);
      }
      
      // 保存
      chrome.storage.local.set({
        'extractedData': existingData
      }, function() {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          console.log('Data saved locally:', newData);
          resolve(newData);
        }
      });
    });
  });
}

// Google Sheetsに保存（フォールバック機能付き）
async function saveToGoogleSheets(data) {
  console.log('Saving to Google Sheets:', data);
  
  try {
    // まずローカルストレージに保存（フォールバック）
    await saveDataLocally(data);
    
    // Google Sheets APIを試行
    try {
      // OAuth認証を取得
      const token = await getAuthToken();
      
      // スプレッドシートの設定を取得
      const settings = await getSettings();
      let spreadsheetId = settings.sheetsConfig.spreadsheetId;
      
      // スプレッドシートが存在しない場合は作成
      if (!spreadsheetId) {
        spreadsheetId = await createSpreadsheet(token);
        
        // 設定を更新
        await updateSettings({
          sheetsConfig: {
            ...settings.sheetsConfig,
            spreadsheetId: spreadsheetId
          }
        });
      }
      
      // データを追加
      await appendToSheet(token, spreadsheetId, data);
      
      return {
        success: true,
        message: 'データをGoogle Sheetsに保存しました',
        spreadsheetId: spreadsheetId
      };
      
    } catch (sheetsError) {
      console.warn('Google Sheets API error, using local storage fallback:', sheetsError);
      
      // Google Sheets APIが失敗した場合はローカル保存のみ
      return {
        success: true,
        message: 'データをローカルに保存しました（Google Sheets APIが利用できません）',
        fallback: true
      };
    }
    
  } catch (error) {
    console.error('Error saving data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 新しいスプレッドシートを作成するハンドラー
async function createNewSpreadsheetHandler() {
  console.log('Creating new spreadsheet via handler...');
  
  try {
    // OAuth認証を取得
    const token = await getAuthToken();
    
    // スプレッドシートを作成
    const spreadsheetId = await createSpreadsheet(token);
    
    // 設定を更新
    const settings = await getSettings();
    await updateSettings({
      sheetsConfig: {
        ...settings.sheetsConfig,
        spreadsheetId: spreadsheetId
      }
    });
    
    return {
      spreadsheetId: spreadsheetId,
      message: 'Spreadsheet created successfully'
    };
    
  } catch (error) {
    console.error('Error in createNewSpreadsheetHandler:', error);
    throw error;
  }
}

// OAuth認証トークンを取得
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(token);
      }
    });
  });
}

// 新しいスプレッドシートを作成
async function createSpreadsheet(token) {
  console.log('Creating spreadsheet with token:', token ? 'Token available' : 'No token');
  
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: 'ebayCPaSS配送情報 - ' + new Date().toLocaleDateString('ja-JP')
      },
      sheets: [{
        properties: {
          title: 'ebayCPaSS抽出データ'
        }
      }]
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Spreadsheet creation failed:', response.status, errorData);
    throw new Error(`Failed to create spreadsheet: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  
  console.log('Spreadsheet created successfully:', spreadsheetId);
  
  // ヘッダー行を追加
  await addHeaderRow(token, spreadsheetId);
  
  return spreadsheetId;
}

// ヘッダー行を追加
async function addHeaderRow(token, spreadsheetId) {
  const headers = [
    '抽出日時',
    '推定送料',
    '追跡番号',
    'ラストマイル追跡番号',
    'ページURL',
    '抽出ステータス'
  ];
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/ebayCPaSS抽出データ!A1:F1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [headers]
      })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to add header row');
  }
}

// シートにデータを追加
async function appendToSheet(token, spreadsheetId, data) {
  const values = [[
    data.extractedAt || new Date().toISOString(),
    data.estimatedShippingCost || '',
    data.trackingNumber || '',
    data.lastMileTrackingNumber || '',
    data.pageUrl || '',
    data.extractionStatus || ''
  ]];
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/ebayCPaSS抽出データ!A:F:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to append data to sheet');
  }
}

// 設定を取得
async function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['extractionSettings', 'sheetsConfig'], function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve({
          extractionSettings: result.extractionSettings || {},
          sheetsConfig: result.sheetsConfig || {}
        });
      }
    });
  });
}

// 設定を更新
async function updateSettings(newSettings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(newSettings, function() {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve();
      }
    });
  });
}

// 保存されたデータを取得
async function getStoredData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['extractedData'], function(result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(result.extractedData || []);
      }
    });
  });
}

// 通知を表示
function showNotification(data) {
  const hasData = data.estimatedShippingCost || data.trackingNumber || data.lastMileTrackingNumber;
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icons/icon48.png',
    title: 'ebayCPaSS2GoogleSheets',
    message: hasData ? 
      '配送情報を抽出しました' : 
      '配送情報が見つかりませんでした'
  });
}

// OAuth認証フローを開始
async function startOAuthFlow(clientId) {
  console.log('Starting OAuth flow with client ID:', clientId);
  
  try {
    // OAuth2認証URLを構築
    const redirectUri = chrome.identity.getRedirectURL();
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ];
    
    const authUrl = `https://accounts.google.com/oauth2/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes.join(' '))}&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    console.log('OAuth URL:', authUrl);
    
    // OAuth認証を実行
    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, function(responseUrl) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (responseUrl) {
          resolve(responseUrl);
        } else {
          reject(new Error('認証がキャンセルされました'));
        }
      });
    });
    
    console.log('OAuth response URL:', responseUrl);
    
    // 認証コードを抽出
    const urlParams = new URL(responseUrl).searchParams;
    const authCode = urlParams.get('code');
    
    if (!authCode) {
      throw new Error('認証コードが取得できませんでした');
    }
    
    // アクセストークンを取得
    const tokenData = await exchangeCodeForToken(clientId, authCode, redirectUri);
    
    // OAuth設定を保存
    await saveOAuthConfig(clientId, tokenData);
    
    return {
      success: true,
      token: tokenData.access_token
    };
    
  } catch (error) {
    console.error('OAuth flow error:', error);
    throw error;
  }
}

// 認証コードをアクセストークンに交換
async function exchangeCodeForToken(clientId, authCode, redirectUri) {
  console.log('Exchanging code for token...');
  
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const requestBody = new URLSearchParams({
    client_id: clientId,
    code: authCode,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: requestBody
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
  }
  
  const tokenData = await response.json();
  console.log('Token exchange successful');
  
  return tokenData;
}

// OAuth設定を保存
async function saveOAuthConfig(clientId, tokenData) {
  return new Promise((resolve, reject) => {
    const oauthConfig = {
      clientId: clientId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      authenticated: true,
      authenticatedAt: new Date().toISOString()
    };
    
    chrome.storage.sync.set({ oauthConfig: oauthConfig }, function() {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log('OAuth config saved');
        resolve(oauthConfig);
      }
    });
  });
}

// OAuth認証を解除
async function revokeOAuthToken() {
  console.log('Revoking OAuth token...');
  
  try {
    // 現在のOAuth設定を取得
    const result = await new Promise((resolve, reject) => {
      chrome.storage.sync.get(['oauthConfig'], function(result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
    
    const oauthConfig = result.oauthConfig;
    
    if (oauthConfig && oauthConfig.accessToken) {
      // Googleのトークン無効化エンドポイントを呼び出し
      const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${oauthConfig.accessToken}`;
      
      try {
        const response = await fetch(revokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        if (!response.ok) {
          console.warn('Token revocation failed, but continuing with local cleanup');
        }
      } catch (error) {
        console.warn('Token revocation request failed, but continuing with local cleanup:', error);
      }
    }
    
    // ローカルのOAuth設定をクリア
    const clearedConfig = {
      clientId: oauthConfig ? oauthConfig.clientId : '',
      accessToken: '',
      refreshToken: '',
      tokenType: '',
      expiresIn: 0,
      expiresAt: 0,
      authenticated: false,
      authenticatedAt: ''
    };
    
    await new Promise((resolve, reject) => {
      chrome.storage.sync.set({ oauthConfig: clearedConfig }, function() {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('OAuth config cleared');
          resolve();
        }
      });
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('Error revoking OAuth token:', error);
    throw error;
  }
}

// Google Sheets APIの接続テスト
async function testGoogleSheetsConnection() {
  console.log('Testing Google Sheets connection...');
  
  try {
    // 現在のOAuth設定を取得
    const result = await new Promise((resolve, reject) => {
      chrome.storage.sync.get(['oauthConfig'], function(result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
    
    const oauthConfig = result.oauthConfig;
    
    if (!oauthConfig || !oauthConfig.authenticated || !oauthConfig.accessToken) {
      throw new Error('OAuth認証が必要です');
    }
    
    // アクセストークンが期限切れかチェック
    if (oauthConfig.expiresAt && Date.now() >= oauthConfig.expiresAt) {
      throw new Error('アクセストークンが期限切れです。再認証が必要です');
    }
    
    // Google Sheets APIにテストリクエストを送信
    const testUrl = 'https://sheets.googleapis.com/v4/spreadsheets?fields=sheets.properties.title';
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${oauthConfig.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API test failed: ${errorData.error.message}`);
    }
    
    console.log('Google Sheets API connection test successful');
    
    return {
      success: true,
      message: 'Google Sheets APIへの接続が成功しました',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Google Sheets connection test failed:', error);
    throw error;
  }
}

// 有効なアクセストークンを取得（リフレッシュ機能付き）
async function getValidAccessToken() {
  const result = await new Promise((resolve, reject) => {
    chrome.storage.sync.get(['oauthConfig'], function(result) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
  
  const oauthConfig = result.oauthConfig;
  
  if (!oauthConfig || !oauthConfig.authenticated) {
    throw new Error('OAuth認証が必要です');
  }
  
  // トークンが期限切れかチェック
  if (oauthConfig.expiresAt && Date.now() >= oauthConfig.expiresAt - 300000) { // 5分前にリフレッシュ
    if (oauthConfig.refreshToken) {
      // リフレッシュトークンを使用してアクセストークンを更新
      const newTokenData = await refreshAccessToken(oauthConfig.clientId, oauthConfig.refreshToken);
      await saveOAuthConfig(oauthConfig.clientId, {
        ...newTokenData,
        refresh_token: oauthConfig.refreshToken // リフレッシュトークンを保持
      });
      return newTokenData.access_token;
    } else {
      throw new Error('アクセストークンが期限切れです。再認証が必要です');
    }
  }
  
  return oauthConfig.accessToken;
}

// アクセストークンをリフレッシュ
async function refreshAccessToken(clientId, refreshToken) {
  console.log('Refreshing access token...');
  
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const requestBody = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: requestBody
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`);
  }
  
  const tokenData = await response.json();
  console.log('Token refresh successful');
  
  return tokenData;
}

console.log('ebayCPaSS2GoogleSheets background service worker initialized'); 