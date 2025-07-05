// eBay CPaSS to Google Sheets - Content Script 修正版
console.log('🚀 eBay CPaSS2GoogleSheets content script loading...');

// グローバル変数
let isDebugMode = false;
let extensionSettings = {
    autoExtract: true,
    buttonMode: 'individual',
    buttonPosition: 'top-right',
    historyRetentionDays: 30,
    saveToSheets: true
};

// デバッグ関数を確実にグローバルに設定
function setupDebugFunctions() {
    window.ebayCPassDebug = {
        enableDebugMode: () => {
            isDebugMode = true;
            console.log('🔧 Debug mode enabled');
        },
        
        disableDebugMode: () => {
            isDebugMode = false;
            console.log('🔧 Debug mode disabled');
        },
        
        debugPageStructure: () => {
            console.log('=== Page Structure Analysis ===');
            console.log('URL:', window.location.href);
            console.log('Title:', document.title);
            console.log('Body classes:', document.body.className);
            
            // 一般的なセレクタをチェック
            const selectors = [
                '.pkg_wrapper',
                '.title_action', 
                '[class*="pkg"]',
                '[class*="wrapper"]',
                '[class*="item"]',
                '[class*="order"]',
                '[class*="delivery"]',
                'tr',
                'tbody tr',
                'table',
                '.ant-table',
                '.ant-table-tbody',
                '.ant-table-row',
                '[data-row-key]',
                '[class*="row"]',
                '[class*="cell"]'
            ];
            
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                console.log(`Selector "${selector}": ${elements.length} elements found`);
                if (elements.length > 0 && elements.length <= 3) {
                    console.log('Sample elements:', elements);
                }
            });
            
            // 特定のクラス名を持つ要素を詳細に分析
            const pkgWrappers = document.querySelectorAll('.pkg_wrapper');
            console.log('📦 Found pkg_wrapper elements:', pkgWrappers.length);
            
            pkgWrappers.forEach((wrapper, index) => {
                console.log(`📋 Wrapper ${index + 1}:`, wrapper);
                console.log('📝 Text content:', wrapper.textContent.substring(0, 200) + '...');
                
                // HTML構造を確認
                const lastMileElement = wrapper.querySelector('.lastmile_no .bold');
                const costElement = wrapper.querySelector('.value');
                const trackingElements = wrapper.querySelectorAll('.bold, .tracking_no, [class*="tracking"]');
                
                console.log('🎯 Last mile element:', lastMileElement?.textContent);
                console.log('💰 Cost element:', costElement?.textContent);
                console.log('📍 Tracking elements:', Array.from(trackingElements).map(el => el.textContent));
                
                // 追跡番号パターンを探す
                const text = wrapper.textContent;
                const emPatterns = text.match(/EM[A-Z0-9]+/g);
                const numberPatterns = text.match(/\b\d{10,15}\b/g);
                
                console.log('🔍 EM patterns found:', emPatterns);
                console.log('🔍 Number patterns found:', numberPatterns);
            });
            
            console.log('=== End Analysis ===');
        },
        
        findDataElements: () => {
            console.log('🔍 Searching for data elements...');
            
            // 段階的に要素を探す - より具体的なターゲットに絞る
            const searchStrategies = [
                // Strategy 1: pkg_wrapper要素（最も適切）
                () => document.querySelectorAll('.pkg_wrapper'),
                // Strategy 2: 配送情報を含む要素
                () => {
                    const elements = document.querySelectorAll('div');
                    return Array.from(elements).filter(div => {
                        const text = div.textContent;
                        return text && (
                            text.includes('USD') && 
                            text.includes('FVF') &&
                            /\d{10,}/.test(text) // 追跡番号
                        );
                    });
                },
                // Strategy 3: 特定のクラス名を持つ配送関連要素
                () => document.querySelectorAll('.orderpackage_info, .pkg_carrier, .pkg_detail'),
                // Strategy 4: Ant Design テーブル
                () => document.querySelectorAll('.ant-table-tbody tr'),
                // Strategy 5: 一般的なテーブル
                () => document.querySelectorAll('table tbody tr')
            ];
            
            for (let i = 0; i < searchStrategies.length; i++) {
                const elements = searchStrategies[i]();
                console.log(`Strategy ${i + 1}: Found ${elements.length} elements`);
                
                if (elements.length > 0 && elements.length <= 100) { // 100個以下に制限
                    console.log('Sample elements:', Array.from(elements).slice(0, 3));
                    return elements;
                }
            }
            
            console.log('❌ No appropriate data elements found');
            return [];
        },
        
        waitForElements: async (selector, timeout = 10000) => {
            console.log(`⏳ Waiting for elements: ${selector}`);
            const startTime = Date.now();
            
            while (Date.now() - startTime < timeout) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`✅ Found ${elements.length} elements after ${Date.now() - startTime}ms`);
                    return elements;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`❌ Timeout: No elements found for ${selector}`);
            return [];
        },
        
        forceAddButtons: () => {
            console.log('🔧 Force adding buttons...');
            const elements = window.ebayCPassDebug.findDataElements();
            if (elements.length > 0) {
                addButtonsToElements(elements);
            } else {
                console.log('❌ No elements found to add buttons');
            }
        },
        
        analyzePageContent: () => {
            console.log('=== Page Content Analysis ===');
            
            // ページの全テキストコンテンツを分析
            const bodyText = document.body.textContent;
            const keywords = ['CP', 'tracking', 'delivery', 'order', 'shipment', '$', 'USD'];
            
            keywords.forEach(keyword => {
                const count = (bodyText.match(new RegExp(keyword, 'gi')) || []).length;
                console.log(`Keyword "${keyword}": ${count} occurrences`);
            });
            
            // 数字パターンの分析
            const numbers = bodyText.match(/\d{10,}/g) || [];
            console.log(`Long numbers (10+ digits): ${numbers.length}`);
            if (numbers.length > 0) {
                console.log('Sample numbers:', numbers.slice(0, 5));
            }
            
            console.log('=== End Content Analysis ===');
        },
        
        checkExtensionStatus: () => {
            console.log('=== Extension Status ===');
            console.log('Current URL:', window.location.href);
            console.log('Is eBay CPaSS site:', window.location.hostname.includes('cpass.ebay.com'));
            console.log('Debug functions available:', typeof window.ebayCPassDebug === 'object');
            console.log('Settings:', extensionSettings);
            console.log('========================');
        }
    };
    
    console.log('✅ Debug functions setup completed');
    console.log('🧪 Available functions:');
    Object.keys(window.ebayCPassDebug).forEach(func => {
        console.log(`   - ${func}()`);
    });
}

// 要素にボタンを追加する関数
function addButtonsToElements(elements) {
    console.log(`📌 Adding buttons to ${elements.length} elements`);
    
    let buttonsAdded = 0;
    Array.from(elements).forEach((element, index) => {
        // 既にボタンがある場合はスキップ
        if (element.querySelector('.ebay-cpass-extract-btn')) {
            return;
        }
        
        // 親要素にもボタンがある場合はスキップ
        if (element.closest('.ebay-cpass-extract-btn')) {
            return;
        }
        
        // 有効なデータを持つ要素のみに追加
        const text = element.textContent;
        const hasValidData = text && (
            text.includes('USD') || 
            text.includes('JPY') || 
            /\d{10,}/.test(text) ||
            text.includes('Scheduled pickup') ||
            text.includes('FVF')
        );
        
        if (!hasValidData) {
            return;
        }
        
        // ボタンを作成
        const button = createExtractButton(element, index);
        
        // ボタンの配置位置を決定
        const insertPosition = extensionSettings.buttonPosition || 'top-right';
        insertButtonInElement(element, button, insertPosition);
        
        buttonsAdded++;
    });
    
    console.log(`✅ Added ${buttonsAdded} buttons to valid elements`);
}

// 抽出ボタンを作成
function createExtractButton(parentElement, index) {
    const button = document.createElement('button');
    button.className = 'ebay-cpass-extract-btn';
    button.innerHTML = '📋 コピー';
    button.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        z-index: 10000;
        background: #0066cc;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        extractDataFromElement(parentElement);
    });
    
    return button;
}

// 要素にボタンを挿入
function insertButtonInElement(element, button, position) {
    // 親要素のスタイルを調整
    if (getComputedStyle(element).position === 'static') {
        element.style.position = 'relative';
    }
    
    element.appendChild(button);
}

// 要素からデータを抽出
function extractDataFromElement(element) {
    console.log('🔍 Extracting data from element:', element);
    
    const extractedData = {
        timestamp: new Date().toISOString(),
        pageUrl: window.location.href,
        extractStatus: 'success'
    };
    
    // テキストからパターンを抽出
    const text = element.textContent;
    console.log('📝 Element text content:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    
    // EMパターンを事前に検索してデバッグ
    const allEMPatterns = text.match(/EM[A-Z0-9]+/g);
    if (allEMPatterns) {
        console.log('🔍 All EM patterns found:', allEMPatterns);
    }
    
    // 全ての数字パターンを事前に検索してデバッグ
    const allNumbers = text.match(/\b\d{6,}\b/g);
    if (allNumbers) {
        console.log('🔢 All numbers (6+ digits) found:', allNumbers);
    }
    
    // パッケージ番号を抽出
    const packageNumberMatch = text.match(/パッケージ番号\s*(\d+)/);
    if (packageNumberMatch) {
        extractedData.packageNumber = packageNumberMatch[1];
    }
    
    // バイヤーIDを抽出
    const buyerIdMatch = text.match(/バイヤーID\s*([^\s]+)/);
    if (buyerIdMatch) {
        extractedData.buyerId = buyerIdMatch[1];
    }
    
    // セラーIDを抽出
    const sellerIdMatch = text.match(/セラーID\s*([^\s]+)/);
    if (sellerIdMatch) {
        extractedData.sellerId = sellerIdMatch[1];
    }
    
    // 合計金額を抽出
    const totalAmountMatch = text.match(/合計金額\s*([\d,]+\.?\d*\s*USD)/);
    if (totalAmountMatch) {
        extractedData.totalAmount = totalAmountMatch[1];
    }
    
    // FVFを抽出
    const fvfMatch = text.match(/FVF\s*([\d,]+\.?\d*\s*USD)/);
    if (fvfMatch) {
        extractedData.fvf = fvfMatch[1];
    }
    
    // 追跡番号を抽出（要求仕様に基づく）
    // 方法1: HTMLの構造から抽出（追跡番号関連のクラスを探す）
    const trackingElements = element.querySelectorAll('.bold, .tracking_no, [class*="tracking"]');
    let foundFromHTML = false;
    
    for (const trackingEl of trackingElements) {
        const trackingText = trackingEl.textContent.trim();
        if (trackingText.startsWith('EM') && trackingText.length > 15) {
            extractedData.trackingNumber = trackingText;
            console.log('✅ Found tracking number from HTML element:', trackingText);
            foundFromHTML = true;
            break;
        }
    }
    
    // 方法2: テキストパターンから抽出（フォールバック）
    if (!foundFromHTML) {
        const trackingPatterns = [
            /\bEM\d{13,}[A-Z0-9]*\b/,  // EMで始まる13桁以上の数字+英数字
            /\bEM[A-Z0-9]{15,}\b/,     // EMで始まる15文字以上の英数字
            /\bEM\d+[A-Z]+\d*[A-Z0-9]*\b/  // EMで始まる数字+文字の組み合わせ
        ];
        
        for (const pattern of trackingPatterns) {
            const match = text.match(pattern);
            if (match) {
                extractedData.trackingNumber = match[0];
                console.log('🎯 Found tracking number:', match[0], 'using pattern:', pattern);
                break;
            }
        }
        
        // 追跡番号が見つからない場合のデバッグ情報
        if (!extractedData.trackingNumber) {
            console.log('🔍 Tracking number not found. Searching for EM patterns in text...');
            const emMatches = text.match(/EM[A-Z0-9]+/g);
            if (emMatches) {
                console.log('📝 Found EM patterns:', emMatches);
                // 最も長いEMパターンを選択
                const longestEM = emMatches.reduce((a, b) => a.length > b.length ? a : b);
                extractedData.trackingNumber = longestEM;
                console.log('✅ Selected longest EM pattern:', longestEM);
            }
        }
    }
    
    // ラストマイル追跡番号の抽出（HTMLの構造を利用）
    // 方法1: lastmile_noクラスから直接抽出
    const lastMileElement = element.querySelector('.lastmile_no .bold');
    if (lastMileElement) {
        extractedData.lastMileTrackingNumber = lastMileElement.textContent.trim();
        console.log('✅ Found last mile number from .lastmile_no:', extractedData.lastMileTrackingNumber);
    } else {
        // 方法2: テキストパターンから抽出（フォールバック）
        const lastMileMatches = text.match(/\b\d{10,15}\b/g);
        console.log('🔍 Found potential last mile numbers:', lastMileMatches);
        
        if (lastMileMatches) {
            // EMで始まる追跡番号以外の数字を抽出
            const lastMileNumbers = lastMileMatches.filter(num => {
                const isNotInTracking = !extractedData.trackingNumber || !extractedData.trackingNumber.includes(num);
                console.log(`📝 Checking ${num}: not in tracking = ${isNotInTracking}`);
                return isNotInTracking;
            });
            
            console.log('📋 Filtered last mile numbers:', lastMileNumbers);
            
            if (lastMileNumbers.length > 0) {
                // 12桁の数字を優先的に選択
                const twelveDigitNumbers = lastMileNumbers.filter(num => num.length === 12);
                if (twelveDigitNumbers.length > 0) {
                    extractedData.lastMileTrackingNumber = twelveDigitNumbers[0];
                    console.log('✅ Selected 12-digit last mile number:', twelveDigitNumbers[0]);
                } else {
                    extractedData.lastMileTrackingNumber = lastMileNumbers[0];
                    console.log('✅ Selected last mile number:', lastMileNumbers[0]);
                }
            }
        }
    }
    
    // 推定送料を抽出（要求仕様に基づく）
    // 方法1: HTMLの構造から抽出
    const costElement = element.querySelector('.value');
    if (costElement && costElement.textContent.includes('JPY')) {
        extractedData.estimatedCost = costElement.textContent.trim();
        console.log('✅ Found cost from .value element:', extractedData.estimatedCost);
    } else {
        // 方法2: テキストパターンから抽出（フォールバック）
        // JPY金額を優先的に抽出
        const jpyMatch = text.match(/([\d,]+\.?\d*)\s*JPY/);
        if (jpyMatch) {
            extractedData.estimatedCost = jpyMatch[1].replace(/,/g, '') + ' JPY';
        } else {
            // JPYがない場合はUSD金額を抽出
            const usdMatch = text.match(/\$?([\d,]+\.?\d*)\s*USD/);
            if (usdMatch) {
                extractedData.estimatedCost = usdMatch[1].replace(/,/g, '') + ' USD';
            }
        }
    }
    
    // 配送情報を探す
    const shippingInfo = {};
    
    // 配送日時
    const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
    if (dateMatch) {
        shippingInfo.date = dateMatch[0];
    }
    
    // 配送時間
    const timeMatch = text.match(/\d{2}:\d{2}/);
    if (timeMatch) {
        shippingInfo.time = timeMatch[0];
    }
    
    // 配送先情報を詳細に抽出
    const countries = ['Italy', 'United States', 'Japan', 'Germany', 'France', 'UK', 'Canada', 'Australia'];
    for (const country of countries) {
        if (text.includes(country)) {
            shippingInfo.country = country;
            break;
        }
    }
    
    // 住所情報を抽出
    const addressMatch = text.match(/(\d+.*?(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Court|Ct|Place|Pl).*?)(?:\n|$)/i);
    if (addressMatch) {
        shippingInfo.address = addressMatch[1].trim();
    }
    
    // 都市名を抽出
    const cityMatch = text.match(/([A-Za-z\s]+)\s+\d{5}/);
    if (cityMatch) {
        shippingInfo.city = cityMatch[1].trim();
    }
    
    // 郵便番号を抽出
    const zipMatch = text.match(/\b\d{5}(?:-\d{4})?\b/);
    if (zipMatch) {
        shippingInfo.zipCode = zipMatch[0];
    }
    
    if (Object.keys(shippingInfo).length > 0) {
        extractedData.shippingInfo = shippingInfo;
    }
    
    console.log('✅ Extracted data:', extractedData);
    
    // 構造化されたデータを見やすく表示（要求仕様に基づく）
    console.table({
        '抽出日時': extractedData.timestamp || 'N/A',
        '推定送料': extractedData.estimatedCost || 'N/A',
        '追跡番号': extractedData.trackingNumber || 'N/A',
        'ラストマイル追跡番号': extractedData.lastMileTrackingNumber || 'N/A',
        'ページURL': extractedData.pageUrl || 'N/A',
        '抽出ステータス': extractedData.extractStatus || 'N/A'
    });
    
    // クリップボードにコピー
    copyToClipboard(extractedData);
    
    return extractedData;
}

// クリップボードにデータをコピー
async function copyToClipboard(data) {
    try {
        console.log('📋 Copying data to clipboard...', data);
        
        // 要求仕様に基づくフォーマットでデータを整形
        const clipboardText = formatDataForClipboard(data);
        
        // クリップボードにコピー
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(clipboardText);
            console.log('✅ Data copied to clipboard successfully');
            
            // 成功通知を表示
            showNotification('データがクリップボードにコピーされました！', 'success');
        } else {
            // フォールバック: テキストエリアを使用
            const textArea = document.createElement('textarea');
            textArea.value = clipboardText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            console.log('✅ Data copied to clipboard (fallback method)');
            showNotification('データがクリップボードにコピーされました！', 'success');
        }
        
    } catch (error) {
        console.error('❌ Error copying to clipboard:', error);
        showNotification('クリップボードへのコピーに失敗しました', 'error');
    }
}

// クリップボード用にデータを整形
function formatDataForClipboard(data) {
    // 要求仕様に基づくタブ区切りフォーマット
    const fields = [
        data.timestamp || '',
        data.estimatedCost || '',
        data.trackingNumber || '',
        data.lastMileTrackingNumber || '',
        data.pageUrl || '',
        data.extractStatus || ''
    ];
    
    return fields.join('\t');
}

// 通知を表示
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
    `;
    
    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else {
        notification.style.backgroundColor = '#2196F3';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 3秒後に自動で削除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// ページの動的読み込み完了を待つ
async function waitForPageContent() {
    console.log('⏳ Waiting for page content to load...');
    
    // 最大30秒待機
    const maxWaitTime = 30000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
        // コンテンツが読み込まれているかチェック
        const hasContent = document.body.textContent.length > 1000;
        const hasElements = document.querySelectorAll('div').length > 20;
        
        if (hasContent && hasElements) {
            console.log(`✅ Page content loaded after ${Date.now() - startTime}ms`);
            return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('⚠️ Page content loading timeout');
    return false;
}

// メイン初期化関数
async function initializeExtension() {
    console.log('🚀 Initializing eBay CPaSS extension...');
    
    // デバッグ関数を設定
    setupDebugFunctions();
    
    // eBay CPaSSサイトかチェック
    if (!window.location.hostname.includes('cpass.ebay.com')) {
        console.log('❌ Not on eBay CPaSS site');
        return;
    }
    
    console.log('✅ On eBay CPaSS site, proceeding with initialization');
    
    // ページコンテンツの読み込み完了を待つ
    await waitForPageContent();
    
    // 初期ページ分析
    window.ebayCPassDebug.debugPageStructure();
    window.ebayCPassDebug.analyzePageContent();
    
    // データ要素を探してボタンを追加
    const dataElements = window.ebayCPassDebug.findDataElements();
    if (dataElements.length > 0) {
        addButtonsToElements(dataElements);
        console.log(`✅ Added buttons to ${dataElements.length} elements`);
    } else {
        console.log('ℹ️ No data elements found initially, will retry with mutation observer');
    }
    
    // DOM変更を監視
    setupMutationObserver();
    
    console.log('✅ Extension initialization completed');
}

// DOM変更監視を設定
function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        let shouldCheckForElements = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldCheckForElements = true;
            }
        });
        
        if (shouldCheckForElements) {
            // デバウンス処理
            clearTimeout(window.ebayCPassMutationTimeout);
            window.ebayCPassMutationTimeout = setTimeout(() => {
                console.log('🔄 DOM changed, checking for new elements...');
                const elements = window.ebayCPassDebug.findDataElements();
                if (elements.length > 0) {
                    addButtonsToElements(elements);
                }
            }, 1000);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('👁️ Mutation observer setup completed');
}

// 初期化実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

// ページ読み込み完了後にも再実行
if (document.readyState !== 'complete') {
    window.addEventListener('load', () => {
        setTimeout(initializeExtension, 2000);
    });
}

console.log('📋 eBay CPaSS2GoogleSheets content script loaded');