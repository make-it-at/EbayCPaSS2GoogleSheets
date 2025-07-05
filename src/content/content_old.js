// ebayCPaSS2GoogleSheets Content Script
// ebayCPaSSサイトから配送情報を抽出

console.log('ebayCPaSS2GoogleSheets content script loaded');

// 拡張機能の読み込み確認用のグローバル変数（最優先で設定）
window.ebayCPassExtensionLoaded = true;

// 拡張機能の動作確認用の簡単な関数（即座に利用可能）
window.checkEbayCPassExtension = function() {
  console.log('🔍 Extension Status Check:');
  console.log('  ✅ Extension loaded:', !!window.ebayCPassExtensionLoaded);
  console.log('  🔧 Debug functions available:', !!window.ebayCPassDebug);
  console.log('  📍 Current URL:', window.location.href);
  console.log('  🕐 Timestamp:', new Date().toISOString());
  
  // ページ上の要素数を確認
  const elementsCount = document.querySelectorAll('*').length;
  console.log('  📊 Total elements on page:', elementsCount);
  
  // 特定の要素を確認
  const tables = document.querySelectorAll('table').length;
  const rows = document.querySelectorAll('tr').length;
  const antElements = document.querySelectorAll('[class*="ant-"]').length;
  console.log('  📋 Tables:', tables, '| Rows:', rows, '| Ant elements:', antElements);
  
  if (window.ebayCPassDebug) {
    console.log('  💡 Try: window.ebayCPassDebug.performDiagnostics()');
  } else {
    console.log('  ⚠️ Debug functions not available yet - wait a moment and try again');
  }
  
  return {
    loaded: !!window.ebayCPassExtensionLoaded,
    debugAvailable: !!window.ebayCPassDebug,
    url: window.location.href,
    elementsCount: elementsCount,
    tables: tables,
    rows: rows,
    antElements: antElements
  };
};

// 関数が確実に定義されていることを確認
if (typeof window.checkEbayCPassExtension === 'function') {
  console.log('✅ checkEbayCPassExtension function confirmed as available globally');
} else {
  console.error('❌ checkEbayCPassExtension function failed to define');
}

// 関数が正しく定義されたことを確認
console.log('✅ checkEbayCPassExtension function defined globally at script start');

// メッセージリスナーを最初に設定（確実に動作するように）
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Content script received message:', request);
    
    if (request.action === 'extractData') {
        // データ抽出
        const data = extractShippingData();
        sendResponse({
            success: true,
            data: data
        });
        return true;
    } else if (request.action === 'getPageData') {
        // ページデータ取得
        const data = extractShippingData();
        sendResponse({
            success: true,
            data: data,
            url: window.location.href
        });
        return true;
    } else if (request.action === 'settingsUpdated') {
        // 設定更新
        console.log('Settings updated:', request.settings);
        updateUIFromSettings(request.settings);
        sendResponse({success: true});
        return true;
    } else if (request.action === 'updateButtonVisibility') {
        // ボタン表示・非表示
        updateButtonVisibility(request.showButtons);
        sendResponse({success: true});
        return true;
    } else if (request.action === 'updateButtonPosition') {
        // ボタン位置変更
        updateButtonPosition(request.position);
        sendResponse({success: true});
        return true;
    }
    
    return false;
});

// 拡張機能の状態確認用
console.log('Content script message listener registered');

// 抽出対象の情報を定義
const DATA_SELECTORS = {
  estimatedShippingCost: 'div span.value', // 推定送料
  trackingNumber: [
    'a span', // 元のセレクター
    'a', // リンク要素全体
    'span[class*=\"track\"]', // trackingを含むクラス
    'td a', // テーブル内のリンク
    'div[class*=\"track\"] span', // trackingを含むdiv内のspan
    'div[class*=\"track\"] a' // trackingを含むdiv内のa
  ],
  lastMileTrackingNumber: [
    'span.bold', // 元のセレクター
    'span[class*=\"bold\"]', // boldを含むクラス
    'strong', // strong要素
    'b', // b要素
    'td span.bold', // テーブル内のboldスパン
    'div[class*=\"last\"] span', // lastを含むdiv内のspan
    'div[class*=\"mile\"] span' // mileを含むdiv内のspan
  ]
};

// サイトのAPI状態を監視
let apiErrorDetected = false;
let pageLoadComplete = false;
let currentSettings = {};
let currentExtractedData = null;

// ネットワークエラーを監視
function monitorNetworkErrors() {
  console.log('🔍 Starting network error monitoring...');
  
  // XMLHttpRequest の監視
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    this._method = method;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('loadend', function() {
      if (this.status >= 400) {
        console.warn(`XHR Error: ${this._method} ${this._url} - Status: ${this.status}`);
        
        // DHL API エラーの特別処理
        if (this._url && this._url.includes('IntegratedCarrierDHL')) {
          console.warn('🚨 DHL API Error detected:', {
            url: this._url,
            status: this.status,
            response: this.responseText
          });
          apiErrorDetected = true;
          showNotification('DHL配送APIでエラーが発生しましたが、データ抽出は継続されます。', 'api-error');
        }
        
        // GetRegisteredCountryCode API エラー
        if (this._url && this._url.includes('GetRegisteredCountryCode')) {
          console.warn('🚨 Country Code API Error detected:', {
            url: this._url,
            status: this.status
          });
          apiErrorDetected = true;
          showNotification('国コード取得APIでエラーが発生しましたが、配送情報の抽出は継続されます。', 'api-error');
        }
        
        // 一般的なAPI エラー
        if (this._url && this._url.includes('/api/')) {
          apiErrorDetected = true;
        }
      }
    });
    
    return originalXHRSend.apply(this, args);
  };
  
  // Fetch API の監視
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    return originalFetch.apply(this, args)
      .then(response => {
        if (!response.ok && typeof url === 'string') {
          console.warn(`Fetch Error: ${url} - Status: ${response.status}`);
          
          // DHL API エラーの特別処理
          if (url.includes('IntegratedCarrierDHL')) {
            console.warn('🚨 DHL API Fetch Error detected:', {
              url: url,
              status: response.status
            });
            apiErrorDetected = true;
            showNotification('DHL配送APIでエラーが発生しましたが、データ抽出は継続されます。', 'api-error');
          }
          
          // GetRegisteredCountryCode API エラー
          if (url.includes('GetRegisteredCountryCode')) {
            console.warn('🚨 Country Code API Fetch Error detected:', {
              url: url,
              status: response.status
            });
            apiErrorDetected = true;
            showNotification('国コード取得APIでエラーが発生しましたが、配送情報の抽出は継続されます。', 'api-error');
          }
          
          if (url.includes('/api/')) {
            apiErrorDetected = true;
          }
        }
        return response;
      })
      .catch(error => {
        console.error('Fetch failed:', url, error);
        if (typeof url === 'string' && url.includes('/api/')) {
          apiErrorDetected = true;
        }
        throw error;
      });
  };
  
  // コンソールエラーも監視
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const errorMessage = args.join(' ');
    
    // DHL API エラーを検出
    if (errorMessage.includes('IntegratedCarrierDHL') || 
        errorMessage.includes('GetRegisteredCountryCode')) {
      console.warn('🚨 Console API Error detected:', errorMessage);
      apiErrorDetected = true;
    }
    
    // 400 Bad Request エラーを検出
    if (errorMessage.includes('400 (Bad Request)') && 
        errorMessage.includes('cpass.ebay.com/api/')) {
      console.warn('🚨 eBay API 400 Error detected:', errorMessage);
      apiErrorDetected = true;
    }
    
    return originalConsoleError.apply(this, args);
  };
  
  // リソース読み込みエラーを監視
  window.addEventListener('error', function(e) {
    if (e.target !== window) {
      const resourceUrl = e.target.src || e.target.href || '';
      
      // フォント読み込みエラーの検出（情報のみ）
      if (resourceUrl.includes('font') || resourceUrl.includes('.woff')) {
        console.info('📝 Font loading detected (non-critical):', resourceUrl);
        // フォントエラーは拡張機能の動作に影響しないため、通知しない
        return;
      }
      
      // API関連のリソースエラーを検出
      if (resourceUrl.includes('api/') || 
          resourceUrl.includes('IntegratedCarrierDHL') ||
          resourceUrl.includes('GetRegisteredCountryCode')) {
        console.warn('🚨 API resource error detected:', resourceUrl);
        apiErrorDetected = true;
        showNotification('API リソースの読み込みエラーが検出されました。', 'api-error');
      }
    }
  });
  
  // Chrome の Intervention メッセージを監視
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    const message = args.join(' ');
    
    // Slow network intervention を検出
    if (message.includes('[Intervention] Slow network is detected')) {
      console.info('📶 Slow network detected by Chrome (non-critical)');
      // ネットワーク速度の警告は拡張機能の動作に影響しないため、通知しない
    }
    
    return originalConsoleLog.apply(this, args);
  };
  
  console.log('✅ Network error monitoring initialized');
}

// データ抽出関数
function extractShippingData() {
  console.log('Starting data extraction...');
  
  const data = {
    extractedAt: new Date().toISOString(),
    pageUrl: window.location.href,
    estimatedShippingCost: null,
    trackingNumber: null,
    lastMileTrackingNumber: null,
    extractionStatus: 'failed',
    apiErrorDetected: apiErrorDetected,
    pageLoadComplete: pageLoadComplete,
    errorDetails: []
  };

  try {
    // APIエラーが検出されている場合の警告
    if (apiErrorDetected) {
      console.warn('API errors detected on this page, extraction may be incomplete');
      data.errorDetails.push('eBay API エラーが検出されました');
      // APIエラーがあってもデータ抽出は継続
      showNotification('APIエラーが検出されましたが、データ抽出を継続します。', 'info');
    }

    // 推定送料の抽出
    const costElement = document.querySelector(DATA_SELECTORS.estimatedShippingCost);
    if (costElement && costElement.textContent) {
      data.estimatedShippingCost = costElement.textContent.trim();
      console.log('Found estimated shipping cost:', data.estimatedShippingCost);
    }

    // 追跡番号の抽出（複数のセレクターを試行）
    for (let selector of DATA_SELECTORS.trackingNumber) {
      const trackingElements = document.querySelectorAll(selector);
      for (let element of trackingElements) {
        const text = element.textContent.trim();
        // 追跡番号らしい文字列を判定（英数字の組み合わせ、10文字以上）
        if (text && text.length > 10 && /^[A-Z0-9]+$/.test(text)) {
          data.trackingNumber = text;
          console.log('Found tracking number:', data.trackingNumber, 'using selector:', selector);
          break;
        }
      }
      if (data.trackingNumber) break; // 見つかったら終了
    }
    
    // 追跡番号が見つからない場合、テキストベースで検索
    if (!data.trackingNumber) {
      const allElements = document.querySelectorAll('*');
      for (let element of allElements) {
        const text = element.textContent ? element.textContent.trim() : '';
        // 追跡番号パターンを検索（EMで始まる英数字）
        const trackingMatch = text.match(/\b(EM[A-Z0-9]{20,})\b/);
        if (trackingMatch) {
          data.trackingNumber = trackingMatch[1];
          console.log('Found tracking number by text search:', data.trackingNumber);
          break;
        }
      }
    }

    // ラストマイル追跡番号の抽出（複数のセレクターを試行）
    for (let selector of DATA_SELECTORS.lastMileTrackingNumber) {
      const lastMileElements = document.querySelectorAll(selector);
      for (let element of lastMileElements) {
        const text = element.textContent.trim();
        // 数字のみの追跡番号を判定（8文字以上）
        if (text && text.length > 8 && /^[0-9]+$/.test(text)) {
          data.lastMileTrackingNumber = text;
          console.log('Found last mile tracking number:', data.lastMileTrackingNumber, 'using selector:', selector);
          break;
        }
      }
      if (data.lastMileTrackingNumber) break; // 見つかったら終了
    }
    
    // ラストマイル追跡番号が見つからない場合、テキストベースで検索
    if (!data.lastMileTrackingNumber) {
      const allElements = document.querySelectorAll('*');
      for (let element of allElements) {
        const text = element.textContent ? element.textContent.trim() : '';
        // 12桁の数字パターンを検索（ラストマイル追跡番号）
        const lastMileMatch = text.match(/\b([0-9]{12})\b/);
        if (lastMileMatch) {
          data.lastMileTrackingNumber = lastMileMatch[1];
          console.log('Found last mile tracking number by text search:', data.lastMileTrackingNumber);
          break;
        }
      }
    }

    // より包括的なデータ検索（APIエラー時のフォールバック）
    if (apiErrorDetected && (!data.estimatedShippingCost || !data.trackingNumber || !data.lastMileTrackingNumber)) {
      console.log('API error detected, attempting fallback extraction methods...');
      
      // フォールバック：ページ全体からパターンマッチング
      const pageText = document.body.innerText || document.body.textContent || '';
      
      // 送料パターンの検索
      if (!data.estimatedShippingCost) {
        const costPatterns = [
          /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:JPY|USD|円))/gi,
          /送料[：:]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:JPY|USD|円))/gi,
          /shipping[：:]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:JPY|USD|円))/gi
        ];
        
        for (let pattern of costPatterns) {
          const matches = pageText.match(pattern);
          if (matches && matches.length > 0) {
            data.estimatedShippingCost = matches[0];
            console.log('Found shipping cost via fallback:', data.estimatedShippingCost);
            data.errorDetails.push('送料をフォールバック方法で抽出');
            break;
          }
        }
      }
      
      // 追跡番号パターンの検索
      if (!data.trackingNumber) {
        const trackingPatterns = [
          /\b(EM[A-Z0-9]{20,})\b/g,
          /\b([A-Z]{2}[0-9]{9}[A-Z]{2})\b/g,
          /\b([A-Z0-9]{13,})\b/g
        ];
        
        for (let pattern of trackingPatterns) {
          const matches = pageText.match(pattern);
          if (matches && matches.length > 0) {
            data.trackingNumber = matches[0];
            console.log('Found tracking number via fallback:', data.trackingNumber);
            data.errorDetails.push('追跡番号をフォールバック方法で抽出');
            break;
          }
        }
      }
      
      // ラストマイル追跡番号パターンの検索
      if (!data.lastMileTrackingNumber) {
        const lastMilePatterns = [
          /\b(\d{12,})\b/g,
          /\b(\d{10,})\b/g
        ];
        
        for (let pattern of lastMilePatterns) {
          const matches = pageText.match(pattern);
          if (matches && matches.length > 0) {
            // 追跡番号として妥当な長さの数字のみを採用
            const candidate = matches[0];
            if (candidate.length >= 10 && candidate.length <= 20) {
              data.lastMileTrackingNumber = candidate;
              console.log('Found last mile tracking number via fallback:', data.lastMileTrackingNumber);
              data.errorDetails.push('ラストマイル追跡番号をフォールバック方法で抽出');
              break;
            }
          }
        }
      }
    }

    // 抽出結果の詳細ログ
    console.log('Extraction results:', {
      estimatedShippingCost: data.estimatedShippingCost ? '✓' : '✗',
      trackingNumber: data.trackingNumber ? '✓' : '✗',
      lastMileTrackingNumber: data.lastMileTrackingNumber ? '✓' : '✗',
      apiErrorDetected: apiErrorDetected ? '⚠️' : '✓'
    });
    
    // 抽出成功の判定
    if (data.estimatedShippingCost || data.trackingNumber || data.lastMileTrackingNumber) {
      data.extractionStatus = 'success';
      console.log('Data extraction successful');
      
      // APIエラーがあった場合は部分的成功として記録
      if (apiErrorDetected) {
        data.extractionStatus = 'partial_success';
        data.errorDetails.push('APIエラーの影響で一部データが不完全な可能性があります');
        showNotification('APIエラーが検出されましたが、データ抽出に成功しました。', 'warning');
      }
    } else {
      data.extractionStatus = 'no_data';
      console.log('No data found');
      
      if (apiErrorDetected) {
        data.errorDetails.push('APIエラーによりデータ抽出に失敗した可能性があります');
        showNotification('APIエラーによりデータが見つかりませんでした。ページを再読み込みしてください。', 'warning');
      }
    }

    // 現在のデータを保存
    currentExtractedData = data;
    
    return data;
  } catch (error) {
    console.error('Error during data extraction:', error);
    data.extractionStatus = 'error';
    data.errorMessage = error.message;
    return data;
  }
}

// ページ読み込み完了時の処理
function onPageReady() {
  console.log('Page ready, DOM loaded');
  pageLoadComplete = true;
  
  // 少し遅延してからボタンを追加
  setTimeout(() => {
    if (currentSettings.showButtonsOnSite) {
      addExtractionButtons();
    }
  }, 1000);
  
  // 自動抽出が有効な場合
  if (currentSettings.autoExtractEnabled) {
    setTimeout(() => {
      performDataExtraction();
    }, 2000);
  }
}

// 自動抽出実行
function performDataExtraction() {
  console.log('Performing automatic data extraction');
  const data = extractShippingData();
  
  // バックグラウンドスクリプトに結果を送信
  chrome.runtime.sendMessage({
    action: 'dataExtracted',
    data: data
  });
}

// クリップボードにコピー
async function copyToClipboard(data) {
  try {
    const textToCopy = formatDataForClipboard(data);
    await navigator.clipboard.writeText(textToCopy);
    console.log('Data copied to clipboard successfully');
    
    // 通知を表示
    if (currentSettings.notificationEnabled) {
      showNotification('データをクリップボードにコピーしました', 'success');
    }
    
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    
    // フォールバック: テキストエリアを使用
    try {
      const textArea = document.createElement('textarea');
      textArea.value = formatDataForClipboard(data);
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (currentSettings.notificationEnabled) {
        showNotification('データをクリップボードにコピーしました', 'success');
      }
      
      return true;
    } catch (fallbackError) {
      console.error('Fallback copy method also failed:', fallbackError);
      showNotification('クリップボードへのコピーに失敗しました', 'error');
      return false;
    }
  }
}

// データをクリップボード用にフォーマット
function formatDataForClipboard(data) {
  const lines = [];
  lines.push('=== ebayCPaSS 配送情報 ===');
  lines.push('抽出日時: ' + new Date(data.extractedAt).toLocaleString('ja-JP'));
  lines.push('ページURL: ' + data.pageUrl);
  lines.push('抽出状態: ' + getExtractionStatusText(data.extractionStatus));
  lines.push('');
  lines.push('推定送料: ' + (data.estimatedShippingCost || 'なし'));
  lines.push('追跡番号: ' + (data.trackingNumber || 'なし'));
  lines.push('ラストマイル追跡番号: ' + (data.lastMileTrackingNumber || 'なし'));
  
  if (data.apiErrorDetected) {
    lines.push('');
    lines.push('⚠️ 注意: ページでAPIエラーが検出されました');
  }
  
  if (data.errorDetails && data.errorDetails.length > 0) {
    lines.push('');
    lines.push('詳細情報:');
    data.errorDetails.forEach(detail => {
      lines.push('- ' + detail);
    });
  }
  
  return lines.join('\n');
}

// 抽出状態のテキスト表示
function getExtractionStatusText(status) {
  switch (status) {
    case 'success':
      return '成功';
    case 'partial_success':
      return '部分的成功（APIエラーあり）';
    case 'no_data':
      return 'データなし';
    case 'error':
      return 'エラー';
    default:
      return '不明';
  }
}

// 通知を表示
function showNotification(message, type = 'info') {
  // 既存の通知を削除
  const existingNotification = document.getElementById('ebay-cpass-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // 新しい通知を作成
  const notification = document.createElement('div');
  notification.id = 'ebay-cpass-notification';
  notification.className = `ebay-cpass-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;
  
  // 閉じるボタンのイベントリスナー
  notification.querySelector('.notification-close').addEventListener('click', function() {
    notification.remove();
  });
  
  // ページに追加
  document.body.appendChild(notification);
  
  // 5秒後に自動削除
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('fade-out');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 5000);
}

// 個別商品にボタンを追加する関数（改良版）
function addButtonsToEachItem() {
  console.log('=== Starting addButtonsToEachItem ===');
  
  // 複数の可能なセレクターを試行（delivered ordersページ対応）
  const possibleSelectors = [
    '.pkg_wrapper',
    '[class*="pkg"]',
    '.package',
    '.item',
    '.product',
    '[class*="order"]',
    '[class*="delivery"]',
    '[class*="delivered"]',
    'tr[class*="pkg"]',
    'tr[class*="order"]',
    'tr[class*="delivery"]',
    '.ant-table-row',
    '.ant-table-tbody tr',
    'tbody tr',
    'table tr',
    'div[class*="wrapper"]',
    'div[class*="row"]',
    'div[class*="item"]',
    // 追加: より具体的なセレクター
    '[data-testid*="order"]',
    '[data-testid*="delivery"]',
    '[data-testid*="package"]',
    '[data-row-key]',
    '[data-id]',
    'div[id*="order"]',
    'div[id*="delivery"]',
    // React/Ant Design特有の構造
    '.ant-card',
    '.ant-card-body',
    '.ant-list-item',
    '.ant-row',
    '.ant-col',
    // 汎用的なコンテナ
    'article',
    'section',
    '[role="row"]',
    '[role="gridcell"]'
  ];
  
  let itemElements = [];
  
  for (const selector of possibleSelectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`Selector "${selector}" found ${elements.length} elements`);
    
    if (elements.length > 0) {
      itemElements = Array.from(elements);
      console.log(`Using selector: ${selector}`);
      break;
    }
  }
  
  if (itemElements.length === 0) {
    console.warn('No package elements found with any selector');
    // フォールバック: 全体的な構造を確認
    console.log('Page structure analysis:');
    console.log('- Body classes:', document.body.className);
    console.log('- Main containers:', document.querySelectorAll('[class*="main"], [class*="container"], [class*="content"]').length);
    console.log('- Tables:', document.querySelectorAll('table').length);
    console.log('- Divs with classes:', document.querySelectorAll('div[class]').length);
    
    // SPAの場合、コンテンツが動的に読み込まれる可能性があるため、少し待ってから再試行
    console.log('Scheduling retry for SPA content loading...');
    setTimeout(() => {
      console.log('Retrying button addition after SPA content load...');
      addButtonsToEachItem();
    }, 3000);
    
    // さらに長い待機時間で再試行
    setTimeout(() => {
      console.log('Final retry for button addition...');
      addButtonsToEachItem();
    }, 10000);
    
    return;
  }
  
  console.log(`Found ${itemElements.length} item elements`);
  
  itemElements.forEach((pkg, idx) => {
    console.log(`Processing item ${idx + 1}/${itemElements.length}`);
    
    // 既存のボタンチェック
    if (pkg.querySelector('.ebay-cpass-extract-copy-btn')) {
      console.log(`Item ${idx + 1} already has button, skipping`);
      return;
    }
    
    // アクションエリアを探す（複数のパターンを試行）
    const actionSelectors = [
      '.title_action',
      '.action',
      '.actions',
      '.buttons',
      '.controls',
      '[class*="action"]',
      '[class*="button"]'
    ];
    
    let actionArea = null;
    for (const selector of actionSelectors) {
      actionArea = pkg.querySelector(selector);
      if (actionArea) {
        console.log(`Found action area with selector: ${selector}`);
        break;
      }
    }
    
    // アクションエリアが見つからない場合は、適切な場所を探す
    if (!actionArea) {
      console.log('No action area found, looking for alternative placement');
      
      // 可能な配置場所を探す（delivered ordersページ対応）
      const alternativeSelectors = [
        '.pkg_carrier',
        '.carrier',
        '.shipping',
        '.header',
        '.title',
        '[class*="delivery"]',
        '[class*="delivered"]',
        '[class*="order"]',
        '[class*="tracking"]',
        '.ant-table-cell',
        'td:last-child',
        'th:last-child',
        'div:last-child',
        '.ant-col:last-child',
        '[class*="column"]:last-child'
      ];
      
      for (const selector of alternativeSelectors) {
        const element = pkg.querySelector(selector);
        if (element) {
          actionArea = element;
          console.log(`Using alternative placement: ${selector}`);
          break;
        }
      }
    }
    
    // 最後の手段として、要素の最後に追加
    if (!actionArea) {
      actionArea = pkg;
      console.log('Using package element itself for button placement');
    }
    
    // ボタンを作成
    const extractCopyBtn = document.createElement('button');
    extractCopyBtn.textContent = '抽出・コピー';
    extractCopyBtn.className = 'ant-btn ant-btn-default btn default ebay-cpass-extract-copy-btn';
    extractCopyBtn.style.cssText = `
      margin-left: 8px;
      margin-top: 4px;
      display: inline-block;
      padding: 4px 8px;
      font-size: 12px;
      background-color: #fff;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      cursor: pointer;
      z-index: 1000;
      position: relative;
    `;
    
    // ホバー効果を追加
    extractCopyBtn.addEventListener('mouseenter', function() {
      this.style.backgroundColor = '#f5f5f5';
      this.style.borderColor = '#40a9ff';
    });
    
    extractCopyBtn.addEventListener('mouseleave', function() {
      this.style.backgroundColor = '#fff';
      this.style.borderColor = '#d9d9d9';
    });
    
    // クリックイベントを追加
    extractCopyBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log(`Button clicked for item ${idx + 1}`);
      handleIndividualExtractAndCopy(pkg, idx);
    });
    
    // ボタンを配置
    try {
      // 既存のボタンがある場合は、その後に追加
      const existingButtons = actionArea.querySelectorAll('button');
      if (existingButtons.length > 0) {
        existingButtons[existingButtons.length - 1].after(extractCopyBtn);
        console.log(`Button added after existing button for item ${idx + 1}`);
      } else {
        // ボタンコンテナを作成して追加
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
          display: inline-block;
          margin-left: 8px;
          vertical-align: top;
        `;
        buttonContainer.appendChild(extractCopyBtn);
        actionArea.appendChild(buttonContainer);
        console.log(`Button container added to item ${idx + 1}`);
      }
      
      console.log(`✅ Button successfully added to item ${idx + 1}`);
      
    } catch (error) {
      console.error(`Error adding button to item ${idx + 1}:`, error);
    }
  });
  
  console.log('=== Finished addButtonsToEachItem ===');
}

// DOM変更監視を改良（より堅牢な実装）
function observePkgWrapper() {
  console.log('Setting up DOM mutation observer...');
  
  let observerTimeout = null;
  
  const observer = new MutationObserver((mutations) => {
    console.log('DOM mutations detected:', mutations.length);
    
    // デバウンス処理（短時間に複数の変更があった場合に一度だけ実行）
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }
    
    observerTimeout = setTimeout(() => {
      console.log('Processing DOM mutations...');
      
      // 新しいパッケージ要素が追加されたかチェック
      let hasNewPackages = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 新しいパッケージ要素または親要素をチェック
              const isPackage = node.classList && (
                node.classList.contains('pkg_wrapper') ||
                node.querySelector && node.querySelector('.pkg_wrapper')
              );
              
              if (isPackage) {
                hasNewPackages = true;
                console.log('New package element detected');
              }
            }
          });
        }
      });
      
      if (hasNewPackages) {
        console.log('Adding buttons to new packages...');
        addButtonsToEachItem();
      }
    }, 500); // 500ms後に実行
  });
  
  // より広範囲を監視
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    attributeOldValue: false,
    characterData: false,
    characterDataOldValue: false
  });
  
  console.log('DOM mutation observer set up successfully');
  
  // 定期的な再チェック（SPA対応）
  setInterval(() => {
    console.log('Periodic button check...');
    addButtonsToEachItem();
  }, 10000); // 10秒ごと
}

// 個別の商品行にボタンを追加
function addButtonToItem(itemElement, index = 0) {
  console.log('Adding button to item:', itemElement);
  
  // 既存のボタンがあるかチェック
  if (itemElement.querySelector('.ebay-cpass-item-buttons')) {
    console.log('Button already exists for this item');
    return;
  }
  
  // ボタンコンテナを作成
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'ebay-cpass-item-buttons';
  buttonContainer.setAttribute('data-item-index', index);
  
  // 抽出ボタン
  const extractBtn = document.createElement('button');
  extractBtn.innerHTML = '📋';
  extractBtn.className = 'ebay-cpass-item-btn ebay-cpass-item-extract-btn';
  extractBtn.title = 'この商品の配送情報を抽出';
  extractBtn.setAttribute('data-item-index', index);
  
  // コピーボタン
  const copyBtn = document.createElement('button');
  copyBtn.innerHTML = '📄';
  copyBtn.className = 'ebay-cpass-item-btn ebay-cpass-item-copy-btn';
  copyBtn.title = 'この商品のデータをコピー';
  copyBtn.setAttribute('data-item-index', index);
  copyBtn.disabled = true; // 初期状態では無効
  
  // 抽出＆コピーボタン
  const extractAndCopyBtn = document.createElement('button');
  extractAndCopyBtn.innerHTML = '📋📄';
  extractAndCopyBtn.className = 'ebay-cpass-item-btn ebay-cpass-item-extract-copy-btn';
  extractAndCopyBtn.title = 'この商品の配送情報を抽出してコピー';
  extractAndCopyBtn.setAttribute('data-item-index', index);
  
  // イベントリスナーを追加
  extractBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    handleIndividualExtract(itemElement, index);
  });
  
  copyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    handleIndividualCopy(itemElement, index);
  });
  
  extractAndCopyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    handleIndividualExtractAndCopy(itemElement, index);
  });
  
  // ボタンをコンテナに追加
  buttonContainer.appendChild(extractBtn);
  buttonContainer.appendChild(copyBtn);
  buttonContainer.appendChild(extractAndCopyBtn);
  
  // ボタンを配置する場所を決定
  let targetElement = null;
  
  // 方法1: 右側の詳細情報エリアに配置
  const rightArea = itemElement.querySelector('td:last-child, div:last-child');
  if (rightArea) {
    targetElement = rightArea;
  }
  
  // 方法2: 推定送料の近くに配置
  const shippingCostElement = itemElement.querySelector('*');
  if (shippingCostElement) {
    const allElements = itemElement.querySelectorAll('*');
    for (let element of allElements) {
      if (element.textContent && element.textContent.includes('JPY')) {
        targetElement = element.parentElement || element;
        break;
      }
    }
  }
  
  // 方法3: 要素の最後に配置
  if (!targetElement) {
    targetElement = itemElement;
  }
  
  // ボタンを配置
  if (targetElement) {
    // 相対位置で配置するためのスタイル調整
    if (targetElement.style.position === '' || targetElement.style.position === 'static') {
      targetElement.style.position = 'relative';
    }
    
    // ボタンコンテナを絶対位置で配置
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.top = '5px';
    buttonContainer.style.right = '5px';
    buttonContainer.style.zIndex = '1000';
    
    targetElement.appendChild(buttonContainer);
    console.log('Button added to item:', index);
  } else {
    console.warn('Could not find target element for button placement');
  }
}

// 個別抽出ハンドラー
function handleIndividualExtract(itemElement, index) {
  console.log('Individual extract for item:', index);
  
  const extractBtn = itemElement.querySelector('.ebay-cpass-item-extract-btn');
  if (!extractBtn) return;
  
  extractBtn.disabled = true;
  extractBtn.innerHTML = '⏳';
  
  try {
    const data = extractDataFromItem(itemElement);
    if (data.estimatedShippingCost || data.trackingNumber || data.lastMileTrackingNumber) {
      extractBtn.innerHTML = '✅';
      showNotification(`商品${index + 1}の配送情報を抽出しました`, 'success');
      
      // データを保存
      itemElement.setAttribute('data-extracted', JSON.stringify(data));
      
      // コピーボタンを有効化
      const copyBtn = itemElement.querySelector('.ebay-cpass-item-copy-btn');
      if (copyBtn) {
        copyBtn.disabled = false;
      }
    } else {
      extractBtn.innerHTML = '❌';
      showNotification('配送情報が見つかりませんでした', 'warning');
    }
  } catch (error) {
    console.error('Individual extract error:', error);
    extractBtn.innerHTML = '❌';
    showNotification('抽出中にエラーが発生しました', 'error');
  }
  
  setTimeout(() => {
    extractBtn.innerHTML = '📋';
    extractBtn.disabled = false;
  }, 2000);
}

// 個別コピーハンドラー
function handleIndividualCopy(itemElement, index) {
  console.log('Individual copy for item:', index);
  
  const copyBtn = itemElement.querySelector('.ebay-cpass-item-copy-btn');
  if (!copyBtn) return;
  
  const extractedData = itemElement.getAttribute('data-extracted');
  if (!extractedData) {
    showNotification('まず抽出ボタンをクリックしてください', 'warning');
    return;
  }
  
  copyBtn.disabled = true;
  copyBtn.innerHTML = '⏳';
  
  try {
    const data = JSON.parse(extractedData);
    copyToClipboard(data).then(success => {
      if (success) {
        copyBtn.innerHTML = '✅';
        showNotification(`商品${index + 1}のデータをコピーしました`, 'success');
      } else {
        copyBtn.innerHTML = '❌';
        showNotification('コピーに失敗しました', 'error');
      }
      
      setTimeout(() => {
        copyBtn.innerHTML = '📄';
        copyBtn.disabled = false;
      }, 2000);
    });
  } catch (error) {
    console.error('Individual copy error:', error);
    copyBtn.innerHTML = '❌';
    showNotification('コピー中にエラーが発生しました', 'error');
    
    setTimeout(() => {
      copyBtn.innerHTML = '📄';
      copyBtn.disabled = false;
    }, 2000);
  }
}

// 個別抽出＆コピーハンドラー（改良版）
function handleIndividualExtractAndCopy(itemElement, index) {
  console.log(`=== Individual extract and copy for item ${index + 1} ===`);
  console.log('Item element:', itemElement);
  
  // 新しいボタンクラス名に対応
  const extractCopyBtn = itemElement.querySelector('.ebay-cpass-extract-copy-btn');
  if (!extractCopyBtn) {
    console.error('Extract copy button not found in item element');
    return;
  }
  
  // ボタンの状態を変更
  extractCopyBtn.disabled = true;
  const originalText = extractCopyBtn.textContent;
  extractCopyBtn.textContent = '処理中...';
  extractCopyBtn.style.backgroundColor = '#f0f0f0';
  
  try {
    console.log('Starting data extraction for item...');
    
    // 個別商品からデータを抽出
    const data = extractDataFromItem(itemElement);
    console.log('Extracted data:', data);
    
    // データが存在するかチェック
    const hasData = data.estimatedShippingCost || data.trackingNumber || data.lastMileTrackingNumber;
    
    if (hasData) {
      console.log('Data found, attempting to copy...');
      
      // データをクリップボードにコピー
      copyToClipboard(data).then(success => {
        if (success) {
          console.log('✅ Copy successful');
          extractCopyBtn.textContent = '完了';
          extractCopyBtn.style.backgroundColor = '#52c41a';
          showNotification(`商品${index + 1}の配送情報を抽出してコピーしました`, 'success');
          
          // データを要素に保存
          itemElement.setAttribute('data-extracted', JSON.stringify(data));
          
          // バックグラウンドスクリプトに送信
          chrome.runtime.sendMessage({
            action: 'dataExtracted',
            data: data,
            itemIndex: index
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.warn('Could not send data to background script:', chrome.runtime.lastError.message);
            }
          });
          
        } else {
          console.warn('Copy failed');
          extractCopyBtn.textContent = 'コピー失敗';
          extractCopyBtn.style.backgroundColor = '#ff7875';
          showNotification('抽出は成功しましたが、コピーに失敗しました', 'warning');
        }
        
        // 2秒後に元の状態に戻す
        setTimeout(() => {
          extractCopyBtn.textContent = originalText;
          extractCopyBtn.style.backgroundColor = '#fff';
          extractCopyBtn.disabled = false;
        }, 2000);
      }).catch(error => {
        console.error('Copy error:', error);
        extractCopyBtn.textContent = 'エラー';
        extractCopyBtn.style.backgroundColor = '#ff7875';
        showNotification('コピー中にエラーが発生しました', 'error');
        
        setTimeout(() => {
          extractCopyBtn.textContent = originalText;
          extractCopyBtn.style.backgroundColor = '#fff';
          extractCopyBtn.disabled = false;
        }, 2000);
      });
      
    } else {
      console.warn('No data found in item');
      extractCopyBtn.textContent = 'データなし';
      extractCopyBtn.style.backgroundColor = '#faad14';
      showNotification(`商品${index + 1}に配送情報が見つかりませんでした`, 'warning');
      
      // 詳細なデバッグ情報を出力
      console.log('Item element content:', itemElement.textContent);
      console.log('Item element HTML:', itemElement.innerHTML);
      
      setTimeout(() => {
        extractCopyBtn.textContent = originalText;
        extractCopyBtn.style.backgroundColor = '#fff';
        extractCopyBtn.disabled = false;
      }, 2000);
    }
    
  } catch (error) {
    console.error('Individual extract and copy error:', error);
    extractCopyBtn.textContent = 'エラー';
    extractCopyBtn.style.backgroundColor = '#ff7875';
    showNotification('処理中にエラーが発生しました', 'error');
    
    setTimeout(() => {
      extractCopyBtn.textContent = originalText;
      extractCopyBtn.style.backgroundColor = '#fff';
      extractCopyBtn.disabled = false;
    }, 2000);
  }
}

// 個別商品からデータを抽出
function extractDataFromItem(itemElement) {
  console.log('Extracting data from item element:', itemElement);
  
  const data = {
    estimatedShippingCost: null,
    trackingNumber: null,
    lastMileTrackingNumber: null,
    extractedAt: new Date().toISOString(),
    pageUrl: window.location.href
  };
  
  // 商品要素内でデータを探す
  const itemText = itemElement.textContent || '';
  
  // 推定送料を抽出
  const costMatch = itemText.match(/(\d{1,3}(?:,\d{3})*\.?\d*)\s*JPY/);
  if (costMatch) {
    data.estimatedShippingCost = costMatch[1] + ' JPY';
  }
  
  // 追跡番号を抽出
  const trackingMatch = itemText.match(/EM\d+[A-Z0-9]+/);
  if (trackingMatch) {
    data.trackingNumber = trackingMatch[0];
  }
  
  // ラストマイル追跡番号を抽出
  const lastMileMatch = itemText.match(/\d{12}/);
  if (lastMileMatch) {
    data.lastMileTrackingNumber = lastMileMatch[0];
  }
  
  console.log('Extracted data from item:', data);
  return data;
}

// 既存のaddExtractionButtons関数を修正
function addExtractionButtons() {
  console.log('Adding extraction buttons to page');
  
  // 設定を確認してボタンの表示方法を決定
  chrome.storage.sync.get({
    extractionSettings: {
      showButtonsOnSite: true,
      buttonMode: 'individual' // 'global' or 'individual'
    }
  }, function(result) {
    const settings = result.extractionSettings;
    
    if (settings.buttonMode === 'individual') {
      // 各商品に個別ボタンを追加
      addButtonsToEachItem();
    } else {
      // 従来の全体ボタンを追加
      addGlobalButtons();
    }
  });
}

// 従来の全体ボタン機能を分離
function addGlobalButtons() {
  // 既存のボタンがあるかチェック
  if (document.querySelector('.ebay-cpass-button-container')) {
    console.log('Global buttons already exist, skipping');
    return;
  }

  // ボタンコンテナを作成
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'ebay-cpass-button-container';

  // 抽出ボタン
  const extractButton = document.createElement('button');
  extractButton.innerHTML = '📋 抽出';
  extractButton.className = 'ebay-cpass-btn ebay-cpass-extract-btn';
  extractButton.title = '配送情報を抽出';
  
  // コピーボタン
  const copyButton = document.createElement('button');
  copyButton.innerHTML = '📄 コピー';
  copyButton.className = 'ebay-cpass-btn ebay-cpass-copy-btn';
  copyButton.title = '最新の抽出データをクリップボードにコピー';
  copyButton.disabled = !currentExtractedData;

  // 抽出＆コピーボタン
  const extractAndCopyButton = document.createElement('button');
  extractAndCopyButton.innerHTML = '📋📄 抽出＆コピー';
  extractAndCopyButton.className = 'ebay-cpass-btn ebay-cpass-extract-copy-btn';
  extractAndCopyButton.title = '配送情報を抽出してクリップボードにコピー';

  // 抽出ボタンのイベントリスナー
  extractButton.addEventListener('click', async function() {
    console.log('Manual extraction triggered');
    extractButton.disabled = true;
    extractButton.innerHTML = '⏳ 抽出中...';
    
    try {
      // 少し遅延してからデータを抽出
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const extractedData = extractShippingData();
      currentExtractedData = extractedData;
      
      // 結果を表示
      let resultMessage = '抽出結果:\n\n';
      resultMessage += '推定送料: ' + (extractedData.estimatedShippingCost || 'なし') + '\n';
      resultMessage += '追跡番号: ' + (extractedData.trackingNumber || 'なし') + '\n';
      resultMessage += 'ラストマイル追跡番号: ' + (extractedData.lastMileTrackingNumber || 'なし');
      
      if (apiErrorDetected) {
        resultMessage += '\n\n⚠️ 注意: ページでAPIエラーが検出されました。\n一部の情報が正しく読み込まれていない可能性があります。';
      }
      
      // 通知で結果を表示
      const hasData = extractedData.estimatedShippingCost || extractedData.trackingNumber || extractedData.lastMileTrackingNumber;
      if (hasData) {
        showNotification('データを抽出しました', 'success');
      } else {
        showNotification('抽出できるデータが見つかりませんでした', 'warning');
      }
      
      // コピーボタンを有効化
      copyButton.disabled = false;
      
      // バックグラウンドスクリプトに送信
      chrome.runtime.sendMessage({
        action: 'dataExtracted',
        data: extractedData
      });
      
    } catch (error) {
      console.error('Extraction error:', error);
      showNotification('抽出中にエラーが発生しました', 'error');
    } finally {
      extractButton.disabled = false;
      extractButton.innerHTML = '📋 抽出';
    }
  });

  // コピーボタンのイベントリスナー
  copyButton.addEventListener('click', async function() {
    if (!currentExtractedData) {
      showNotification('まず抽出ボタンをクリックしてデータを抽出してください', 'warning');
      return;
    }
    
    copyButton.disabled = true;
    copyButton.innerHTML = '⏳ コピー中...';
    
    try {
      const success = await copyToClipboard(currentExtractedData);
      
      if (success) {
        copyButton.innerHTML = '✅ コピー完了';
        setTimeout(() => {
          copyButton.innerHTML = '📄 コピー';
          copyButton.disabled = false;
        }, 2000);
      } else {
        copyButton.innerHTML = '❌ コピー失敗';
        setTimeout(() => {
          copyButton.innerHTML = '📄 コピー';
          copyButton.disabled = false;
        }, 2000);
      }
    } catch (error) {
      console.error('Copy error:', error);
      copyButton.innerHTML = '❌ コピー失敗';
      setTimeout(() => {
        copyButton.innerHTML = '📄 コピー';
        copyButton.disabled = false;
      }, 2000);
    }
  });

  // 抽出＆コピーボタンのイベントリスナー
  extractAndCopyButton.addEventListener('click', async function() {
    console.log('Extract and copy triggered');
    extractAndCopyButton.disabled = true;
    extractAndCopyButton.innerHTML = '⏳ 処理中...';
    
    try {
      // データを抽出
      await new Promise(resolve => setTimeout(resolve, 500));
      const extractedData = extractShippingData();
      currentExtractedData = extractedData;
      
      // データが抽出できた場合はコピーも実行
      const hasData = extractedData.estimatedShippingCost || extractedData.trackingNumber || extractedData.lastMileTrackingNumber;
      
      if (hasData) {
        const copySuccess = await copyToClipboard(extractedData);
        if (copySuccess) {
          extractAndCopyButton.innerHTML = '✅ 完了';
          showNotification('データを抽出してクリップボードにコピーしました', 'success');
        } else {
          extractAndCopyButton.innerHTML = '❌ コピー失敗';
          showNotification('抽出は成功しましたが、コピーに失敗しました', 'warning');
        }
      } else {
        extractAndCopyButton.innerHTML = '❌ データなし';
        showNotification('抽出できるデータが見つかりませんでした', 'warning');
      }
      
      // コピーボタンを有効化
      copyButton.disabled = false;
      
      // バックグラウンドスクリプトに送信
      chrome.runtime.sendMessage({
        action: 'dataExtracted',
        data: extractedData
      });
      
    } catch (error) {
      console.error('Extract and copy error:', error);
      extractAndCopyButton.innerHTML = '❌ エラー';
      showNotification('処理中にエラーが発生しました', 'error');
    } finally {
      setTimeout(() => {
        extractAndCopyButton.innerHTML = '📋📄 抽出＆コピー';
        extractAndCopyButton.disabled = false;
      }, 2000);
    }
  });

  // ボタンをコンテナに追加
  buttonContainer.appendChild(extractButton);
  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(extractAndCopyButton);

  // ページの適切な位置にボタンを追加
  document.body.appendChild(buttonContainer);
  
  console.log('Global extraction buttons added successfully');
}

// 個別ボタンを削除する関数
function removeIndividualButtons() {
  const itemButtons = document.querySelectorAll('.ebay-cpass-item-buttons');
  itemButtons.forEach(buttonContainer => {
    buttonContainer.remove();
  });
  console.log('Individual item buttons removed');
}

// 設定からUIを更新
function updateUIFromSettings(settings) {
    if (settings.extractionSettings) {
        // ボタン表示・非表示
        updateButtonVisibility(settings.extractionSettings.showButtonsOnSite);
        
        // ボタン位置
        updateButtonPosition(settings.extractionSettings.buttonPosition);
    }
}

// ボタンの表示・非表示を更新
function updateButtonVisibility(showButtons) {
    const container = document.querySelector('.ebay-cpass-button-container');
    if (container) {
        container.style.display = showButtons ? 'flex' : 'none';
    }
}

// ボタンの位置を更新
function updateButtonPosition(position) {
    const container = document.querySelector('.ebay-cpass-button-container');
    if (!container) return;
    
    // 既存の位置クラスを削除
    container.classList.remove('position-top-left', 'position-top-right', 'position-bottom-left', 'position-bottom-right');
    
    // 新しい位置クラスを追加
    container.classList.add(`position-${position}`);
    
    // CSSスタイルを直接適用
    switch (position) {
        case 'top-left':
            container.style.top = '20px';
            container.style.left = '20px';
            container.style.right = 'auto';
            container.style.bottom = 'auto';
            break;
        case 'top-right':
            container.style.top = '20px';
            container.style.right = '20px';
            container.style.left = 'auto';
            container.style.bottom = 'auto';
            break;
        case 'bottom-left':
            container.style.bottom = '20px';
            container.style.left = '20px';
            container.style.right = 'auto';
            container.style.top = 'auto';
            break;
        case 'bottom-right':
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.left = 'auto';
            container.style.top = 'auto';
            break;
    }
}

// 設定を読み込む関数
function loadSettings() {
  chrome.storage.sync.get({
    extractionSettings: {
      autoExtract: false,
      saveToSheets: true,
      showNotifications: true,
      showButtonsOnSite: true,
      buttonPosition: 'top-right',
      buttonMode: 'individual',
      historyRetentionDays: 30
    }
  }, function(result) {
    if (chrome.runtime.lastError) {
      console.error('Error loading settings:', chrome.runtime.lastError.message);
      // デフォルト設定を使用
      currentSettings = {
        autoExtract: false,
        saveToSheets: true,
        showNotifications: true,
        showButtonsOnSite: true,
        buttonPosition: 'top-right',
        buttonMode: 'individual',
        historyRetentionDays: 30
      };
      return;
    }
    
    currentSettings = result.extractionSettings || {
      autoExtract: false,
      saveToSheets: true,
      showNotifications: true,
      showButtonsOnSite: true,
      buttonPosition: 'top-right',
      buttonMode: 'individual',
      historyRetentionDays: 30
    };
    
    console.log('Settings loaded:', currentSettings);
    
    // 設定変更をバックグラウンドに通知
    chrome.runtime.sendMessage({
      action: 'settingsLoaded',
      settings: currentSettings
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.warn('Could not notify background script:', chrome.runtime.lastError.message);
      }
    });
  });
}

// デバッグ用のヘルパー関数を追加
function debugPageStructure() {
  console.log('=== Page Structure Debug ===');
  console.log('URL:', window.location.href);
  console.log('Title:', document.title);
  console.log('Body classes:', document.body.className);
  
  // delivered ordersページ特有のセレクターを含む主要なセレクターをテスト
  const selectors = [
    '.pkg_wrapper',
    '.title_action',
    '[class*="pkg"]',
    '[class*="wrapper"]',
    '[class*="item"]',
    '[class*="product"]',
    '[class*="order"]',
    '[class*="delivery"]',
    '[class*="delivered"]',
    'tr',
    'tbody tr',
    'table tr',
    '.ant-table-tbody tr',
    '.ant-table tr',
    '.ant-table-row',
    '[class*="ant-table"]',
    '[class*="table"]',
    '[class*="row"]',
    '[class*="cell"]'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`Selector "${selector}": ${elements.length} elements found`);
    
    if (elements.length > 0 && elements.length <= 5) {
      elements.forEach((el, idx) => {
        console.log(`  ${idx + 1}. Classes: "${el.className}", Tag: ${el.tagName}`);
        if (el.textContent && el.textContent.length > 0) {
          const preview = el.textContent.substring(0, 100).replace(/\s+/g, ' ').trim();
          console.log(`      Text preview: "${preview}${el.textContent.length > 100 ? '...' : ''}"`);
        }
      });
    }
  });
  
  // 特定のキーワードを含む要素を検索（JavaScriptでフィルタリング）
  const keywords = ['JPY', 'EM', 'tracking', 'shipping', 'cost', 'carrier'];
  keywords.forEach(keyword => {
    const allElements = document.querySelectorAll('*');
    const matchingElements = Array.from(allElements).filter(el => 
      el.textContent && el.textContent.includes(keyword)
    );
    if (matchingElements.length > 0) {
      console.log(`Elements containing "${keyword}": ${matchingElements.length}`);
      // 最初の数個の要素の詳細を表示
      matchingElements.slice(0, 3).forEach((el, idx) => {
        console.log(`  ${idx + 1}. ${el.tagName}.${el.className} - "${el.textContent.substring(0, 50).replace(/\s+/g, ' ').trim()}..."`);
      });
    }
  });
  
  // 現在のボタンの状態を確認
  const existingButtons = document.querySelectorAll('.ebay-cpass-extract-copy-btn');
  console.log(`Current buttons on page: ${existingButtons.length}`);
  
  if (existingButtons.length > 0) {
    existingButtons.forEach((btn, idx) => {
      console.log(`  Button ${idx + 1}: ${btn.textContent}, Visible: ${btn.offsetWidth > 0 && btn.offsetHeight > 0}`);
    });
  }
  
  console.log('=== End Page Structure Debug ===');
}

// デバッグモード管理
function enableDebugMode() {
  localStorage.setItem('ebay-cpass-debug', 'true');
  console.log('🐛 Debug mode enabled');
  console.log('Run debugPageStructure() to see current page structure');
  console.log('Run disableDebugMode() to disable debug mode');
  console.log('Run logErrorReport() to see detailed error report');
  debugPageStructure();
  logErrorReport();
}

function disableDebugMode() {
  localStorage.removeItem('ebay-cpass-debug');
  console.log('✅ Debug mode disabled');
}

// デバッグ用のグローバル関数をウィンドウに追加（開発時のみ）
if (typeof window !== 'undefined') {
  window.ebayCPassDebug = {
    enableDebugMode,
    disableDebugMode,
    debugPageStructure,
    logErrorReport,
    generateErrorReport,
    addButtonsToEachItem,
    extractShippingData,
    currentSettings,
    currentExtractedData,
    apiErrorDetected: () => apiErrorDetected,
    pageLoadComplete: () => pageLoadComplete,
    checkExtensionStatus: checkInitializationStatus,
    forceAddButtons: () => {
      console.log('🔧 Force adding buttons...');
      addButtonsToEachItem();
    },
    testNetworkMonitoring: () => {
      console.log('🔧 Testing network monitoring...');
      monitorNetworkErrors();
    },
    performDiagnostics: performExtensionDiagnostics,
    quickHealthCheck: quickHealthCheck,
    findDataElements: () => {
      console.log('🔍 Searching for data elements...');
      
      // 実際にデータを含む要素を探す
      const dataElements = [];
      
      // JPY を含む要素を探す
      const jpyElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('JPY') && el.textContent.trim().length < 100
      );
      
      // EM で始まる追跡番号を含む要素を探す
      const trackingElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && /EM\d+/.test(el.textContent) && el.textContent.trim().length < 100
      );
      
      // 数字のみの最終マイル追跡番号を含む要素を探す
      const lastMileElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && /^\d{12}$/.test(el.textContent.trim())
      );
      
      console.log('Found data elements:');
      console.log('- JPY elements:', jpyElements.length);
      console.log('- Tracking elements:', trackingElements.length);
      console.log('- Last mile elements:', lastMileElements.length);
      
      // 親要素を特定
      const allDataElements = [...jpyElements, ...trackingElements, ...lastMileElements];
      const parentElements = new Set();
      
      allDataElements.forEach(el => {
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
          parentElements.add(parent);
          parent = parent.parentElement;
        }
      });
      
      console.log('Potential parent containers:', parentElements.size);
      
      // 最も可能性の高い親要素を特定
      const candidates = Array.from(parentElements).filter(el => {
        const hasJPY = el.textContent.includes('JPY');
        const hasTracking = /EM\d+/.test(el.textContent);
        const hasLastMile = /\d{12}/.test(el.textContent);
        return hasJPY && hasTracking && hasLastMile;
      });
      
      console.log('Best candidates for button placement:', candidates.length);
      candidates.forEach((el, idx) => {
        console.log(`  ${idx + 1}. ${el.tagName}.${el.className} (${el.children.length} children)`);
      });
      
      return {
        jpyElements,
        trackingElements,
        lastMileElements,
        candidates
      };
    },
    addButtonsToDataElements: () => {
      console.log('🔧 Adding buttons to data elements...');
      const { candidates } = window.ebayCPassDebug.findDataElements();
      
      if (candidates.length === 0) {
        console.log('No suitable elements found for button placement');
        return;
      }
      
      candidates.forEach((element, idx) => {
        // 既存のボタンをチェック
        if (element.querySelector('.ebay-cpass-extract-copy-btn')) {
          console.log(`Element ${idx + 1} already has button, skipping`);
          return;
        }
        
        // ボタンを作成
        const extractCopyBtn = document.createElement('button');
        extractCopyBtn.textContent = '抽出・コピー';
        extractCopyBtn.className = 'ant-btn ant-btn-default btn default ebay-cpass-extract-copy-btn';
        extractCopyBtn.style.cssText = `
          margin: 8px;
          padding: 4px 8px;
          font-size: 12px;
          background-color: #ff4d4f;
          color: white;
          border: 1px solid #ff4d4f;
          border-radius: 4px;
          cursor: pointer;
          z-index: 1000;
          position: relative;
        `;
        
        // クリックイベントを追加
        extractCopyBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log(`Button clicked for element ${idx + 1}`);
          handleIndividualExtractAndCopy(element, idx);
        });
        
        // ボタンを配置
        element.appendChild(extractCopyBtn);
        console.log(`✅ Button added to element ${idx + 1}`);
      });
    }
  };
  
  // グローバルな便利関数も追加
  window.checkEbayCPassExtension = () => {
    console.log('🔧 Extension Status Check:');
    console.log('- Extension loaded:', !!window.ebayCPassDebug);
    console.log('- Page load complete:', pageLoadComplete);
    console.log('- API error detected:', apiErrorDetected);
    console.log('- Current URL:', window.location.href);
    console.log('- Document ready state:', document.readyState);
    console.log('- Buttons on page:', document.querySelectorAll('.ebay-cpass-extract-copy-btn').length);
    return {
      extensionLoaded: !!window.ebayCPassDebug,
      pageLoadComplete,
      apiErrorDetected,
      currentUrl: window.location.href,
      documentReadyState: document.readyState,
      buttonsCount: document.querySelectorAll('.ebay-cpass-extract-copy-btn').length
    };
  };

  console.log('🔧 Debug functions available via window.ebayCPassDebug');
  console.log('   - enableDebugMode(): Enable debug logging');
  console.log('   - disableDebugMode(): Disable debug logging');
  console.log('   - debugPageStructure(): Analyze page structure');
  console.log('   - logErrorReport(): Generate detailed error report');
  console.log('   - checkExtensionStatus(): Check extension status');
  console.log('   - forceAddButtons(): Force add buttons');
  console.log('   - testNetworkMonitoring(): Test network monitoring');
  console.log('   - performDiagnostics(): Comprehensive diagnostics');
  console.log('   - quickHealthCheck(): Quick health check');
  console.log('   - findDataElements(): Find elements containing data');
  console.log('   - addButtonsToDataElements(): Add buttons to data elements');
  console.log('   - apiErrorDetected(): Check API error status');
  console.log('   - currentSettings(): Get current settings');
}

// 初期化時にデバッグ情報を出力
function initializeWithDebug() {
  console.log('=== Extension Initialization ===');
  
  // 基本情報
  console.log('Extension loaded at:', new Date().toISOString());
  console.log('Page URL:', window.location.href);
  console.log('Page title:', document.title);
  console.log('Document ready state:', document.readyState);
  
  // ページ構造をデバッグ
  debugPageStructure();
  
  // 設定を読み込み
  loadSettings();
  
  // ネットワークエラー監視を開始
  monitorNetworkErrors();
  
  // API状態監視を開始
  startAPIStatusMonitoring();
  
  // DOM監視を開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
  } else {
    onDOMContentLoaded();
  }
  
  // ウィンドウ読み込み完了時の処理
  if (document.readyState === 'complete') {
    onWindowLoad();
  } else {
    window.addEventListener('load', onWindowLoad);
  }
  
  // 定期的なデバッグ出力（開発時のみ）
  if (localStorage.getItem('ebay-cpass-debug') === 'true') {
    setInterval(() => {
      console.log('=== Periodic Debug Check ===');
      debugPageStructure();
    }, 30000); // 30秒ごと
  }
  
  console.log('=== Extension Initialization Complete ===');
}

// API状態監視を開始
function startAPIStatusMonitoring() {
  console.log('Starting API status monitoring...');
  
  // API状態の定期チェック
  setInterval(() => {
    // DHL API の状態をチェック
    const dhlApiElements = document.querySelectorAll('[data-api*="DHL"], [data-api*="IntegratedCarrier"]');
    if (dhlApiElements.length > 0) {
      console.log('DHL API elements found:', dhlApiElements.length);
    }
    
    // API エラーの状態をログ出力
    if (apiErrorDetected) {
      console.log('API Error Status: DETECTED - Data extraction will use fallback methods');
    }
    
    // ネットワーク状態の確認（誤検出を防ぐ）
    // navigator.onLineは信頼性が低いため、実際のデータ抽出が成功している場合は無視
    if (navigator.onLine === false && !currentExtractedData) {
      console.log('Network may be offline, but checking actual connectivity...');
      // 実際にリクエストを送信して確認
      fetch('/favicon.ico', { method: 'HEAD', cache: 'no-cache' })
        .then(() => {
          console.log('Network is actually online, navigator.onLine is incorrect');
        })
        .catch(() => {
          console.warn('Network is actually offline');
          showNotification('ネットワーク接続が切断されています。', 'error');
        });
    }
    
    // ページの応答性をチェック
    const pageLoadTime = performance.now();
    if (pageLoadTime > 10000) { // 10秒以上
      console.warn('Page load time is slow:', pageLoadTime, 'ms');
    }
    
  }, 30000); // 30秒ごとにチェック
  
  // 特定のAPIエラーパターンを監視
  const checkForSpecificAPIErrors = () => {
    // コンソールログから特定のエラーパターンを検索
    const errorPatterns = [
      'GetRegisteredCountryCode',
      'IntegratedCarrierDHL',
      '400 ()',
      'Failed to load resource',
      'the server responded with a status of 400'
    ];
    
    // Performance APIを使用してリソースの読み込み状況をチェック
    if (window.performance && window.performance.getEntriesByType) {
      const resources = window.performance.getEntriesByType('resource');
      const apiResources = resources.filter(resource => 
        resource.name.includes('api/') || 
        resource.name.includes('IntegratedCarrier') ||
        resource.name.includes('GetRegisteredCountryCode')
      );
      
      apiResources.forEach(resource => {
        if (resource.responseEnd === 0) {
          console.warn('API resource failed to load:', resource.name);
          apiErrorDetected = true;
        }
      });
    }
  };
  
  // 初回チェック
  setTimeout(checkForSpecificAPIErrors, 5000);
  
  // 定期的なチェック
  setInterval(checkForSpecificAPIErrors, 60000); // 1分ごと
}

// DOM読み込み完了時の処理（改良版）
function onDOMContentLoaded() {
    console.log('=== DOM content loaded ===');
    pageLoadComplete = true;
    
    // ページ構造の詳細分析
    console.log('Page analysis:');
    console.log('- URL:', window.location.href);
    console.log('- Title:', document.title);
    console.log('- Body classes:', document.body.className);
    console.log('- Total elements:', document.querySelectorAll('*').length);
    
    // 設定に基づいてボタンを表示
    if (currentSettings.showButtonsOnSite) {
        console.log('Showing buttons on site, mode:', currentSettings.buttonMode);
        
        // 段階的にボタンを追加（複数のタイミングで試行）
        const addButtonsWithRetry = () => {
            console.log('Attempting to add buttons...');
            
            if (currentSettings.buttonMode === 'individual') {
                console.log('Adding individual buttons...');
                addButtonsToEachItem();
                
                // DOM変更監視を開始
                observePkgWrapper();
            } else {
                console.log('Adding global buttons...');
                addGlobalButtons();
            }
        };
        
        // 即座に実行
        addButtonsWithRetry();
        
        // 1秒後に再試行
        setTimeout(() => {
            console.log('1秒後の再試行...');
            addButtonsWithRetry();
        }, 1000);
        
        // 3秒後に再試行
        setTimeout(() => {
            console.log('3秒後の再試行...');
            addButtonsWithRetry();
        }, 3000);
        
        // 5秒後に再試行
        setTimeout(() => {
            console.log('5秒後の再試行...');
            addButtonsWithRetry();
        }, 5000);
        
        // 10秒後に最終確認
        setTimeout(() => {
            console.log('10秒後の最終確認...');
            const existingButtons = document.querySelectorAll('.ebay-cpass-extract-copy-btn');
            console.log(`現在のボタン数: ${existingButtons.length}`);
            
            if (existingButtons.length === 0) {
                console.warn('⚠️ ボタンが1つも追加されていません');
                console.log('最終デバッグ情報:');
                
                // 詳細なページ構造分析
                const allDivs = document.querySelectorAll('div');
                console.log(`- Total divs: ${allDivs.length}`);
                
                const classedDivs = document.querySelectorAll('div[class]');
                console.log(`- Divs with classes: ${classedDivs.length}`);
                
                const tables = document.querySelectorAll('table');
                console.log(`- Tables: ${tables.length}`);
                
                const rows = document.querySelectorAll('tr');
                console.log(`- Table rows: ${rows.length}`);
                
                // 可能なパッケージ要素を全て探す
                const possiblePackages = [
                    ...document.querySelectorAll('[class*="pkg"]'),
                    ...document.querySelectorAll('[class*="package"]'),
                    ...document.querySelectorAll('[class*="item"]'),
                    ...document.querySelectorAll('[class*="product"]'),
                    ...document.querySelectorAll('[class*="wrapper"]')
                ];
                
                console.log(`- Possible package elements: ${possiblePackages.length}`);
                
                if (possiblePackages.length > 0) {
                    console.log('Sample package element classes:');
                    possiblePackages.slice(0, 5).forEach((el, idx) => {
                        console.log(`  ${idx + 1}. ${el.className}`);
                    });
                }
                
                // 強制的に再試行
                console.log('強制的に再試行を実行...');
                addButtonsWithRetry();
                
                // データ要素ベースでボタン追加を試行
                console.log('🔍 データ要素ベースでボタン追加を試行...');
                const dataBasedButtons = tryAddButtonsToDataElements();
                
                // さらに積極的にボタンを追加
                if (dataBasedButtons === 0) {
                    console.log('🔧 フォールバック: 全てのテーブル行にボタンを追加...');
                    addButtonsToAllTableRows();
                }
            } else {
                console.log('✅ ボタンが正常に追加されました');
            }
        }, 10000);
        
        // SPA対応: 20秒後と30秒後にも再試行
        setTimeout(() => {
            console.log('20秒後のSPA対応再試行...');
            const existingButtons = document.querySelectorAll('.ebay-cpass-extract-copy-btn');
            if (existingButtons.length === 0) {
                console.log('SPA遅延読み込み対応で再試行します...');
                addButtonsWithRetry();
            }
        }, 20000);
        
        setTimeout(() => {
            console.log('30秒後の最終SPA対応再試行...');
            const existingButtons = document.querySelectorAll('.ebay-cpass-extract-copy-btn');
            if (existingButtons.length === 0) {
                console.log('最終的なSPA対応再試行を実行します...');
                addButtonsWithRetry();
                
                // 30秒後でもボタンが見つからない場合は、詳細な診断を実行
                setTimeout(() => {
                    const finalButtons = document.querySelectorAll('.ebay-cpass-extract-copy-btn');
                    if (finalButtons.length === 0) {
                        console.warn('🚨 30秒経過してもボタンが追加されませんでした');
                        console.log('📊 データ要素ベースの検索を試行します...');
                        
                        // データ要素ベースの検索を実行
                        const dataButtonsAdded = tryAddButtonsToDataElements();
                        
                        if (dataButtonsAdded === 0) {
                            console.log('📊 詳細な診断を実行します...');
                            if (window.ebayCPassDebug && window.ebayCPassDebug.performDiagnostics) {
                                window.ebayCPassDebug.performDiagnostics();
                            }
                        }
                    }
                }, 2000);
            }
        }, 30000);
    }
    
    // 自動抽出が有効な場合
    if (currentSettings.autoExtract) {
        console.log('Auto extract enabled, starting extraction...');
        setTimeout(() => {
            const data = extractShippingData();
            if (data && (data.estimatedShippingCost || data.trackingNumber || data.lastMileTrackingNumber)) {
                console.log('Auto extraction successful:', data);
                showNotification('配送情報を自動抽出しました', 'success');
            }
        }, 2000);
    }
}

// データ要素を探してボタンを追加する関数
function tryAddButtonsToDataElements() {
    console.log('🔍 データ要素を探してボタンを追加します...');
    
    // ページ全体の要素数を確認
    const allElements = document.querySelectorAll('*');
    console.log(`Total elements on page: ${allElements.length}`);
    
    // 実際のデータを含む要素を探す
    const dataElements = [];
    
    // JPY を含む要素を探す（より広範囲に検索）
    const jpyElements = Array.from(allElements).filter(el => {
        const text = el.textContent || '';
        return text.includes('JPY') || text.includes('¥') || /\d+\.\d+\s*JPY/.test(text);
    });
    
    // EM で始まる追跡番号を含む要素を探す
    const trackingElements = Array.from(allElements).filter(el => {
        const text = el.textContent || '';
        return /EM\d{11,13}/.test(text) || /[A-Z]{2}\d{9}[A-Z]{2}/.test(text);
    });
    
    // 数字のみの最終マイル追跡番号を含む要素を探す
    const lastMileElements = Array.from(allElements).filter(el => {
        const text = el.textContent ? el.textContent.trim() : '';
        return /^\d{10,15}$/.test(text) || /^\d{4}-\d{4}-\d{4}$/.test(text);
    });
    
    // 配送関連のキーワードを含む要素を探す
    const shippingElements = Array.from(allElements).filter(el => {
        const text = el.textContent || '';
        return text.includes('配送') || text.includes('shipping') || text.includes('delivery') || 
               text.includes('追跡') || text.includes('tracking') || text.includes('荷物');
    });
    
    // テーブル行を探す
    const tableRows = Array.from(document.querySelectorAll('tr')).filter(row => {
        const text = row.textContent || '';
        return text.includes('JPY') || text.includes('EM') || /\d{10,15}/.test(text);
    });
    
    console.log(`Found elements: JPY=${jpyElements.length}, Tracking=${trackingElements.length}, LastMile=${lastMileElements.length}, Shipping=${shippingElements.length}, TableRows=${tableRows.length}`);
    
    // 各データ要素の親要素を特定
    const parentElements = new Set();
    
    // すべてのデータ要素を統合
    const allDataElements = [...jpyElements, ...trackingElements, ...lastMileElements, ...shippingElements];
    
    // テーブル行を優先的に追加
    tableRows.forEach(row => {
        parentElements.add(row);
    });
    
    allDataElements.forEach(el => {
        let parent = el.parentElement;
        let depth = 0;
        
        // 適切な親要素を見つける（最大7レベル上まで）
        while (parent && depth < 7) {
            // テーブル行、divコンテナ、または特定のクラスを持つ要素を探す
            if (parent.tagName === 'TR' || 
                parent.tagName === 'DIV' && (parent.className.includes('item') || 
                                           parent.className.includes('row') || 
                                           parent.className.includes('container') || 
                                           parent.className.includes('wrapper') ||
                                           parent.className.includes('ant-') ||
                                           parent.className.includes('table') ||
                                           parent.className.includes('cell'))) {
                parentElements.add(parent);
                break;
            }
            parent = parent.parentElement;
            depth++;
        }
        
        // 親要素が見つからない場合は、元の要素の直接の親を使用
        if (depth >= 7 && el.parentElement) {
            parentElements.add(el.parentElement);
        }
    });
    
    console.log(`Found ${parentElements.size} potential parent elements`);
    
    // 各親要素にボタンを追加
    let buttonsAdded = 0;
    Array.from(parentElements).forEach((parent, index) => {
        // 既にボタンが存在するかチェック
        if (parent.querySelector('.ebay-cpass-extract-copy-btn')) {
            console.log(`Button already exists for parent ${index}`);
            return;
        }
        
        // ボタンを追加する適切な位置を見つける
        let buttonContainer = parent;
        
        // テーブル行の場合は最後のセルに追加
        if (parent.tagName === 'TR') {
            const lastCell = parent.querySelector('td:last-child') || parent.querySelector('th:last-child');
            if (lastCell) {
                buttonContainer = lastCell;
            }
        } else if (parent.tagName === 'DIV') {
            // DIVの場合は、適切な子要素を探す
            const potentialContainers = parent.querySelectorAll('div:last-child, span:last-child, .ant-col:last-child');
            if (potentialContainers.length > 0) {
                buttonContainer = potentialContainers[potentialContainers.length - 1];
            }
        }
        
        // ボタンを作成
        const button = document.createElement('button');
        button.className = 'ebay-cpass-extract-copy-btn ant-btn ant-btn-default btn default';
        button.textContent = '抽出＆コピー';
        button.style.cssText = `
            margin-left: 8px;
            margin-right: 8px;
            background-color: #ff4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            z-index: 1000;
            position: relative;
        `;
        
        // ボタンのイベントリスナーを追加
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`Data-based button clicked for element ${index}`);
            handleIndividualExtractAndCopy(parent, index);
        });
        
        // ボタンを追加
        buttonContainer.appendChild(button);
        buttonsAdded++;
        
        console.log(`Added button to parent element ${index} (${parent.tagName})`);
    });
    
    console.log(`✅ Added ${buttonsAdded} buttons based on data elements`);
    
    if (buttonsAdded > 0) {
        showNotification(`${buttonsAdded}個のボタンを追加しました`, 'success');
    }
    
    return buttonsAdded;
}

// フォールバック: 全てのテーブル行にボタンを追加
function addButtonsToAllTableRows() {
    console.log('🔧 フォールバック: 全てのテーブル行にボタンを追加します...');
    
    const allRows = document.querySelectorAll('tr');
    let buttonsAdded = 0;
    
    allRows.forEach((row, index) => {
        // 既にボタンが存在するかチェック
        if (row.querySelector('.ebay-cpass-extract-copy-btn')) {
            return;
        }
        
        // ヘッダー行をスキップ
        if (row.querySelector('th')) {
            return;
        }
        
        // 空の行をスキップ
        if (!row.textContent || row.textContent.trim().length < 10) {
            return;
        }
        
        // 最後のセルを取得
        const lastCell = row.querySelector('td:last-child');
        if (!lastCell) {
            return;
        }
        
        // ボタンを作成
        const button = document.createElement('button');
        button.className = 'ebay-cpass-extract-copy-btn ant-btn ant-btn-default btn default';
        button.textContent = '抽出';
        button.style.cssText = `
            margin-left: 8px;
            background-color: #ff4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            z-index: 1000;
            position: relative;
        `;
        
        // ボタンのイベントリスナーを追加
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`Fallback button clicked for row ${index}`);
            handleIndividualExtractAndCopy(row, index);
        });
        
        // ボタンを追加
        lastCell.appendChild(button);
        buttonsAdded++;
        
        console.log(`Added fallback button to row ${index}`);
    });
    
    console.log(`✅ Added ${buttonsAdded} fallback buttons to table rows`);
    
    if (buttonsAdded > 0) {
        showNotification(`フォールバック機能で${buttonsAdded}個のボタンを追加しました`, 'info');
    }
    
    return buttonsAdded;
}

// ページ完全読み込み完了時の処理
function onWindowLoad() {
    console.log('Window load complete');
    
    // 自動抽出が有効な場合
    if (currentSettings.autoExtract) {
        setTimeout(() => {
            const data = extractShippingData();
            if (data && (data.estimatedShippingCost || data.trackingNumber || data.lastMileTrackingNumber)) {
                console.log('Auto-extracted data:', data);
                currentExtractedData = data;
                
                if (currentSettings.showNotifications) {
                    showNotification('データを自動抽出しました', 'success');
                }
            }
        }, 2000);
    }
}

// デバッグ用のエラー状態レポート機能を追加
function generateErrorReport() {
  const report = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    apiErrorDetected: apiErrorDetected,
    pageLoadComplete: pageLoadComplete,
    networkStatus: navigator.onLine ? 'online' : 'offline',
    performance: {
      loadTime: performance.now(),
      resourceErrors: []
    },
    domInfo: {
      totalElements: document.querySelectorAll('*').length,
      pkgWrappers: document.querySelectorAll('.pkg_wrapper').length,
      titleActions: document.querySelectorAll('.title_action').length,
      existingButtons: document.querySelectorAll('.ebay-cpass-extract-copy-btn').length
    },
    errors: []
  };
  
  // Performance API からリソースエラーを収集
  if (window.performance && window.performance.getEntriesByType) {
    const resources = window.performance.getEntriesByType('resource');
    resources.forEach(resource => {
      if (resource.responseEnd === 0 || resource.duration < 0) {
        report.performance.resourceErrors.push({
          name: resource.name,
          type: resource.initiatorType,
          duration: resource.duration
        });
      }
    });
  }
  
  // 特定のAPIエラーをチェック
  const apiErrors = [
    'GetRegisteredCountryCode',
    'IntegratedCarrierDHL',
    'cpass.ebay.com/api'
  ];
  
  apiErrors.forEach(apiName => {
    const elements = document.querySelectorAll(`[data-api*="${apiName}"]`);
    if (elements.length > 0) {
      report.errors.push(`${apiName} API elements found: ${elements.length}`);
    }
  });
  
  return report;
}

// エラーレポートを出力する関数
function logErrorReport() {
  const report = generateErrorReport();
  console.group('🔍 eBay CPaSS Extension - Error Report');
  console.log('📊 Report:', report);
  console.log('🚨 API Error Status:', apiErrorDetected ? 'DETECTED' : 'NONE');
  console.log('🌐 Network Status:', report.networkStatus);
  console.log('⏱️ Page Load Time:', Math.round(report.performance.loadTime), 'ms');
  console.log('📦 Package Elements:', report.domInfo.pkgWrappers);
  console.log('🔘 Existing Buttons:', report.domInfo.existingButtons);
  
  if (report.performance.resourceErrors.length > 0) {
    console.warn('❌ Resource Errors:', report.performance.resourceErrors);
  }
  
  if (report.errors.length > 0) {
    console.warn('⚠️ API Issues:', report.errors);
  }
  
  console.groupEnd();
  return report;
}

// デバッグ用のグローバル関数をウィンドウに追加（開発時のみ）
function setupDebugFunctions() {
  if (typeof window !== 'undefined') {
    // 既存のデバッグオブジェクトを確認
    if (window.ebayCPassDebug) {
      console.log('🔧 Debug functions already exists, updating...');
    } else {
      console.log('🔧 Setting up debug functions...');
    }
    
    // 即座にテスト関数を提供
    window.ebayCPassDebugTest = function() {
      console.log('✅ Debug functions are working!');
      console.log('📍 URL:', window.location.href);
      console.log('🕐 Time:', new Date().toISOString());
      return true;
    };
    
    window.ebayCPassDebug = {
      enableDebugMode,
      disableDebugMode,
      debugPageStructure,
      logErrorReport,
      generateErrorReport,
      addButtonsToEachItem,
      extractShippingData,
      currentSettings: () => currentSettings,
      currentExtractedData: () => currentExtractedData,
      apiErrorDetected: () => apiErrorDetected,
      pageLoadComplete: () => pageLoadComplete,
      // 新しいデバッグ関数を追加
      checkExtensionStatus: () => {
        console.log('=== Extension Status ===');
        console.log('✅ Extension loaded:', !!window.ebayCPassDebug);
        console.log('📄 Current URL:', window.location.href);
        console.log('⚙️ Settings loaded:', !!currentSettings);
        console.log('🔘 API Error detected:', apiErrorDetected);
        console.log('📦 Page load complete:', pageLoadComplete);
        console.log('🔍 Total elements:', document.querySelectorAll('*').length);
        console.log('🎯 Package wrappers:', document.querySelectorAll('.pkg_wrapper').length);
        console.log('🔘 Existing buttons:', document.querySelectorAll('.ebay-cpass-extract-copy-btn').length);
        return {
          loaded: true,
          url: window.location.href,
          settings: currentSettings,
          apiError: apiErrorDetected,
          pageComplete: pageLoadComplete
        };
      },
      forceAddButtons: () => {
        console.log('🔧 Force adding buttons...');
        addButtonsToEachItem();
      },
      testNetworkMonitoring: () => {
        console.log('🔍 Testing network monitoring...');
        // テスト用のAPI呼び出し
        fetch('/api/test-endpoint').catch(err => {
          console.log('Expected test error:', err.message);
        });
      },
      performDiagnostics: performExtensionDiagnostics,
      quickHealthCheck: quickHealthCheck,
      findDataElements: () => {
        console.log('🔍 Searching for data elements...');
        
        // JPY を含む要素を探す
        const jpyElements = Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && el.textContent.includes('JPY') && 
          el.textContent.trim().length < 200 && 
          el.textContent.trim().length > 3
        );
        
        // EM で始まる追跡番号を含む要素を探す
        const trackingElements = Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && /EM\d+/.test(el.textContent) && 
          el.textContent.trim().length < 50
        );
        
        // 数字のみの最終マイル追跡番号を含む要素を探す
        const lastMileElements = Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && /^\d{10,15}$/.test(el.textContent.trim())
        );
        
        console.log(`Found elements: JPY=${jpyElements.length}, Tracking=${trackingElements.length}, LastMile=${lastMileElements.length}`);
        
        // 各要素の詳細を表示
        if (jpyElements.length > 0) {
          console.log('JPY elements (first 3):');
          jpyElements.slice(0, 3).forEach((el, idx) => {
            console.log(`  ${idx + 1}. "${el.textContent.trim()}" (${el.tagName})`);
          });
        }
        
        if (trackingElements.length > 0) {
          console.log('Tracking elements (first 3):');
          trackingElements.slice(0, 3).forEach((el, idx) => {
            console.log(`  ${idx + 1}. "${el.textContent.trim()}" (${el.tagName})`);
          });
        }
        
        if (lastMileElements.length > 0) {
          console.log('Last mile elements (first 3):');
          lastMileElements.slice(0, 3).forEach((el, idx) => {
            console.log(`  ${idx + 1}. "${el.textContent.trim()}" (${el.tagName})`);
          });
        }
        
        return {
          jpyElements: jpyElements.length,
          trackingElements: trackingElements.length,
          lastMileElements: lastMileElements.length
        };
      },
      addButtonsToDataElements: () => {
        console.log('🔧 Adding buttons to data elements...');
        const result = tryAddButtonsToDataElements();
        console.log(`Added ${result} buttons`);
        return result;
      },
      forceAddButtonsToAllRows: () => {
        console.log('🔧 Force adding buttons to all table rows...');
        const result = addButtonsToAllTableRows();
        console.log(`Added ${result} fallback buttons`);
        return result;
      },
      analyzePageStructure: () => {
        console.log('🔍 Analyzing page structure...');
        
        const analysis = {
          tables: document.querySelectorAll('table').length,
          rows: document.querySelectorAll('tr').length,
          cells: document.querySelectorAll('td').length,
          divs: document.querySelectorAll('div').length,
          antElements: document.querySelectorAll('[class*="ant-"]').length,
          jpyText: document.body.textContent.match(/JPY/g)?.length || 0,
          trackingNumbers: document.body.textContent.match(/EM\d{11,13}/g)?.length || 0,
          lastMileNumbers: document.body.textContent.match(/\d{10,15}/g)?.length || 0
        };
        
        console.log('📊 Page Analysis:', analysis);
        
        // サンプルテーブル行を表示
        const sampleRows = Array.from(document.querySelectorAll('tr')).slice(0, 3);
        console.log('🔍 Sample table rows:');
        sampleRows.forEach((row, idx) => {
          console.log(`  Row ${idx + 1}:`, row.textContent.trim().substring(0, 100) + '...');
        });
        
        return analysis;
      }
    };
    
    console.log('🔧 Debug functions available via window.ebayCPassDebug');
    console.log('   - enableDebugMode(): Enable debug logging');
    console.log('   - disableDebugMode(): Disable debug logging');
    console.log('   - debugPageStructure(): Analyze page structure');
    console.log('   - logErrorReport(): Generate detailed error report');
    console.log('   - checkExtensionStatus(): Check extension status');
    console.log('   - forceAddButtons(): Force add buttons');
    console.log('   - testNetworkMonitoring(): Test network monitoring');
    console.log('   - performDiagnostics(): Comprehensive diagnostics');
    console.log('   - quickHealthCheck(): Quick health check');
    console.log('   - findDataElements(): Find elements containing data');
    console.log('   - addButtonsToDataElements(): Add buttons to data elements');
    console.log('   - forceAddButtonsToAllRows(): Force add buttons to all table rows');
    console.log('   - analyzePageStructure(): Detailed page structure analysis');
    console.log('   - apiErrorDetected(): Check API error status');
    console.log('   - currentSettings(): Get current settings');
    
    // 設定完了を確認
      // テスト用の関数
  window.ebayCPassDebugTest = () => {
    console.log('🧪 Running debug test...');
    console.log('1. Extension status:', window.checkEbayCPassExtension());
    console.log('2. Page structure analysis:');
    window.ebayCPassDebug.debugPageStructure();
    console.log('3. Quick health check:');
    window.ebayCPassDebug.quickHealthCheck();
    console.log('4. Finding data elements:');
    window.ebayCPassDebug.findDataElements();
    console.log('5. Attempting to add buttons to data elements:');
    window.ebayCPassDebug.addButtonsToDataElements();
    console.log('🧪 Debug test completed');
  };

  console.log('✅ Debug functions setup completed');
  console.log('🧪 Test with: window.ebayCPassDebugTest()');
  }
}

// 拡張機能の初期化状態を確認
function checkInitializationStatus() {
  console.log('=== Extension Initialization Status ===');
  console.log('🕐 Timestamp:', new Date().toISOString());
  console.log('📄 URL:', window.location.href);
  console.log('📋 Document ready state:', document.readyState);
  console.log('🔧 Debug functions available:', !!window.ebayCPassDebug);
  
  // 設定の読み込み状態を確認
  if (currentSettings) {
    console.log('⚙️ Settings loaded successfully');
    console.log('   - Show buttons:', currentSettings.showButtonsOnSite);
    console.log('   - Button mode:', currentSettings.buttonMode);
    console.log('   - Auto extract:', currentSettings.autoExtract);
  } else {
    console.warn('⚠️ Settings not loaded yet');
  }
  
  // DOM要素の確認
  const elementCounts = {
    total: document.querySelectorAll('*').length,
    divs: document.querySelectorAll('div').length,
    tables: document.querySelectorAll('table').length,
    rows: document.querySelectorAll('tr').length,
    pkgWrappers: document.querySelectorAll('.pkg_wrapper').length,
    buttons: document.querySelectorAll('.ebay-cpass-extract-copy-btn').length
  };
  
  console.log('📊 DOM Elements:', elementCounts);
  
  // ネットワーク監視の状態
  console.log('🌐 Network monitoring:', {
    online: navigator.onLine,
    apiError: apiErrorDetected,
    pageComplete: pageLoadComplete
  });
  
  return elementCounts;
}

// 🚀 eBay CPaSS2GoogleSheets Extension Initialization
console.log('🚀 eBay CPaSS2GoogleSheets content script loaded');
console.log('📍 Current URL:', window.location.href);
console.log('📄 Document ready state:', document.readyState);

// 拡張機能の読み込み確認用のグローバル変数（最優先で設定）
window.ebayCPassExtensionLoaded = true;

// 関数は上部で既に定義済み（重複を削除）

// 正しいサイトURLかどうかを確認
const isCorrectSite = window.location.href.includes('cpass.ebay.com');
const isDeliveredPage = window.location.href.includes('/order/delivered');
console.log('✅ Correct site (cpass.ebay.com):', isCorrectSite);
console.log('📦 Delivered page (/order/delivered):', isDeliveredPage);

if (isCorrectSite && isDeliveredPage) {
  console.log('🎯 Perfect! This is the correct eBay CPaSS delivered orders page');
  console.log('📋 Extension will now initialize for delivered orders functionality');
} else if (isCorrectSite) {
  console.log('📍 This is eBay CPaSS site but not the delivered orders page');
  console.log('💡 Extension will still work on other eBay CPaSS pages');
} else {
  console.log('⚠️ This is not the expected eBay CPaSS site');
  console.log('🔄 If you just updated the extension, please reload the page');
  console.log('📋 Expected URL pattern: https://cpass.ebay.com/order/delivered');
}

// デバッグ関数を最初にセットアップ（最優先）
setupDebugFunctions();

// 初期化を実行
initializeWithDebug();

// 初期化状態を確認（遅延実行）
setTimeout(() => {
  checkInitializationStatus();
  console.log('✅ Extension initialization completed');
}, 1000); 

// 拡張機能の動作確認を容易にするため、詳細なデバッグ情報を出力し、問題の特定を支援する機能を追加します
function performExtensionDiagnostics() {
  console.group('🔍 eBay CPaSS Extension - Comprehensive Diagnostics');
  
  // 基本情報
  console.log('📋 Basic Information:');
  console.log('  • Extension version: 1.0.0');
  console.log('  • Current URL:', window.location.href);
  console.log('  • Page title:', document.title);
  console.log('  • User agent:', navigator.userAgent);
  console.log('  • Timestamp:', new Date().toISOString());
  
  // 拡張機能の状態
  console.log('\n⚙️ Extension Status:');
  console.log('  • Debug functions available:', !!window.ebayCPassDebug);
  console.log('  • Settings loaded:', !!currentSettings);
  console.log('  • Page load complete:', pageLoadComplete);
  console.log('  • API error detected:', apiErrorDetected);
  
  // 設定情報
  if (currentSettings) {
    console.log('\n🔧 Current Settings:');
    console.log('  • Show buttons on site:', currentSettings.showButtonsOnSite);
    console.log('  • Button mode:', currentSettings.buttonMode);
    console.log('  • Auto extract:', currentSettings.autoExtract);
    console.log('  • Show notifications:', currentSettings.showNotifications);
  }
  
  // DOM 分析
  console.log('\n📊 DOM Analysis:');
  const domStats = {
    totalElements: document.querySelectorAll('*').length,
    divElements: document.querySelectorAll('div').length,
    tableElements: document.querySelectorAll('table').length,
    rowElements: document.querySelectorAll('tr').length,
    pkgWrappers: document.querySelectorAll('.pkg_wrapper').length,
    titleActions: document.querySelectorAll('.title_action').length,
    existingButtons: document.querySelectorAll('.ebay-cpass-extract-copy-btn').length,
    antButtons: document.querySelectorAll('.ant-btn').length,
    possiblePackages: document.querySelectorAll('[class*="pkg"], [class*="package"], [class*="item"], [class*="wrapper"]').length
  };
  
  Object.entries(domStats).forEach(([key, value]) => {
    console.log(`  • ${key}: ${value}`);
  });
  
  // 可能なパッケージ要素の詳細分析
  const possiblePackageElements = document.querySelectorAll('[class*="pkg"], [class*="package"], [class*="item"], [class*="wrapper"]');
  if (possiblePackageElements.length > 0) {
    console.log('\n📦 Possible Package Elements (first 5):');
    Array.from(possiblePackageElements).slice(0, 5).forEach((el, idx) => {
      console.log(`  ${idx + 1}. Tag: ${el.tagName}, Classes: ${el.className}`);
    });
  }
  
  // ネットワーク状態
  console.log('\n🌐 Network Status:');
  console.log('  • Online:', navigator.onLine);
  console.log('  • Connection type:', navigator.connection?.effectiveType || 'unknown');
  console.log('  • API errors detected:', apiErrorDetected);
  
  // パフォーマンス情報
  if (window.performance) {
    console.log('\n⏱️ Performance:');
    console.log('  • Page load time:', Math.round(performance.now()), 'ms');
    console.log('  • DOM content loaded:', performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart, 'ms');
    console.log('  • Window load complete:', performance.timing.loadEventEnd - performance.timing.navigationStart, 'ms');
  }
  
  // エラー情報
  const errorReport = generateErrorReport();
  if (errorReport.performance.resourceErrors.length > 0) {
    console.log('\n❌ Resource Errors:');
    errorReport.performance.resourceErrors.forEach((error, idx) => {
      console.log(`  ${idx + 1}. ${error.name} (${error.type})`);
    });
  }
  
  // 推奨アクション
  console.log('\n💡 Recommended Actions:');
  
  if (!window.ebayCPassDebug) {
    console.log('  ⚠️ Debug functions not available - Extension may not be loaded properly');
  }
  
  if (domStats.pkgWrappers === 0) {
    console.log('  ⚠️ No .pkg_wrapper elements found - Page structure may have changed');
    console.log('  📝 Try: window.ebayCPassDebug.debugPageStructure()');
  }
  
  if (domStats.existingButtons === 0 && currentSettings?.showButtonsOnSite) {
    console.log('  ⚠️ No buttons found but should be visible');
    console.log('  📝 Try: window.ebayCPassDebug.forceAddButtons()');
  }
  
  if (apiErrorDetected) {
    console.log('  ⚠️ API errors detected - Some features may be limited');
    console.log('  📝 This is normal and does not affect data extraction');
  }
  
  console.groupEnd();
  return domStats;
}

// 簡単なヘルスチェック機能
function quickHealthCheck() {
  const health = {
    extensionLoaded: !!window.ebayCPassDebug,
    settingsLoaded: !!currentSettings,
    pageReady: pageLoadComplete,
    apiErrors: apiErrorDetected,
    buttonsVisible: document.querySelectorAll('.ebay-cpass-extract-copy-btn').length > 0,
    packageElements: document.querySelectorAll('.pkg_wrapper, [class*="pkg"]').length > 0
  };
  
  const score = Object.values(health).filter(Boolean).length;
  const total = Object.keys(health).length;
  
  console.log(`🏥 Health Check: ${score}/${total} checks passed`);
  
  Object.entries(health).forEach(([key, value]) => {
    const icon = value ? '✅' : '❌';
    console.log(`  ${icon} ${key}: ${value}`);
  });
  
  return health;
}