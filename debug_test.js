// デバッグテスト用のスクリプト
// ブラウザのコンソールで実行してください

console.log('=== eBay CPaSS Extension Debug Test ===');

// 1. 拡張機能の基本状態確認
console.log('1. 拡張機能の基本状態:');
console.log('   - Extension loaded:', !!window.ebayCPassExtensionLoaded);
console.log('   - Debug object available:', !!window.ebayCPassDebug);
console.log('   - checkEbayCPassExtension available:', typeof window.checkEbayCPassExtension);

// 2. 利用可能な機能の確認
if (window.ebayCPassDebug) {
  console.log('2. 利用可能なデバッグ機能:');
  console.log('   - checkExtensionStatus:', typeof window.ebayCPassDebug.checkExtensionStatus);
  console.log('   - findDataElements:', typeof window.ebayCPassDebug.findDataElements);
  console.log('   - addButtonsToDataElements:', typeof window.ebayCPassDebug.addButtonsToDataElements);
  console.log('   - analyzePageStructure:', typeof window.ebayCPassDebug.analyzePageStructure);
  console.log('   - performDiagnostics:', typeof window.ebayCPassDebug.performDiagnostics);
  console.log('   - quickHealthCheck:', typeof window.ebayCPassDebug.quickHealthCheck);
} else {
  console.log('2. ❌ window.ebayCPassDebug オブジェクトが利用できません');
}

// 3. 実際にデバッグ機能を実行
console.log('3. デバッグ機能の実行:');

try {
  if (window.ebayCPassDebug && window.ebayCPassDebug.checkExtensionStatus) {
    console.log('   🔍 拡張機能ステータス確認中...');
    window.ebayCPassDebug.checkExtensionStatus();
  }
} catch (error) {
  console.error('   ❌ checkExtensionStatus エラー:', error);
}

try {
  if (window.ebayCPassDebug && window.ebayCPassDebug.findDataElements) {
    console.log('   🔍 データ要素検索中...');
    window.ebayCPassDebug.findDataElements();
  }
} catch (error) {
  console.error('   ❌ findDataElements エラー:', error);
}

try {
  if (window.ebayCPassDebug && window.ebayCPassDebug.quickHealthCheck) {
    console.log('   🔍 クイックヘルスチェック実行中...');
    window.ebayCPassDebug.quickHealthCheck();
  }
} catch (error) {
  console.error('   ❌ quickHealthCheck エラー:', error);
}

console.log('=== Debug Test Complete ==='); 