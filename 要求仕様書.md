# ebayCPaSS2GoogleSheets Chrome拡張機能 要求仕様書

## プロジェクト概要

### 目的
ebayCPaSSサイトから配送関連情報を自動抽出し、Google Sheetsスプレッドシートに保存することで、推定送料と実際の送料の差異を把握するためのChrome拡張機能を開発する。

### 対象サイト
- ebayCPaSS（eBayセラー向け発送管理サイト）

### 対象ユーザー
- eBayセラー
- ebayCPaSSを利用している配送業者

## 機能要件

### 1. データ抽出機能

#### 1.1 推定送料の抽出
- **対象要素**: `<div><span class="value">2,486.00 JPY</span></div>`
- **抽出データ**: 金額（数値）と通貨単位
- **データ形式**: `{ amount: 2486.00, currency: "JPY" }`

#### 1.2 追跡番号の抽出
- **対象要素**: `<a><span>&nbsp;</span>EM1013071241398FE06040099C0N</a>`
- **抽出データ**: 追跡番号文字列
- **データ形式**: `{ trackingNumber: "EM1013071241398FE06040099C0N" }`

#### 1.3 ラストマイル追跡番号の抽出
- **対象要素**: `<span class="bold">882312169260</span>`
- **抽出データ**: ラストマイル追跡番号
- **データ形式**: `{ lastMileTrackingNumber: "882312169260" }`

### 2. データ処理機能

#### 2.1 データ統合
- 1つの配送レコードとして3つの情報を統合
- タイムスタンプの付与
- ページURL情報の保存

#### 2.2 データ検証
- 推定送料の数値妥当性チェック
- 追跡番号の形式検証
- 重複データの検出・除外

### 3. データ出力機能

#### 3.1 CSV出力
- 抽出データをCSV形式でダウンロード
- ヘッダー: `抽出日時,推定送料,追跡番号,ラストマイル追跡番号,ページURL,抽出ステータス`

#### 3.2 Google Sheets連携（メイン機能）
- Google Sheets APIへの連携
- 初回実行時にスプレッドシート作成
- 以降は同一シートにデータ追記
- **シート構造**:
  - A列: 抽出日時
  - B列: 推定送料
  - C列: 追跡番号
  - D列: ラストマイル追跡番号
  - E列: ページURL
  - F列: 抽出ステータス

### 4. ユーザーインターフェース

#### 4.1 ポップアップUI
- データ抽出ボタン
- 抽出結果の表示
- CSV出力ボタン
- Google Sheets連携ボタン
- 設定画面へのリンク

#### 4.2 設定画面
- Google Sheets API設定
- スプレッドシートID設定
- 抽出対象の選択
- 自動抽出の設定

#### 4.3 コンテンツスクリプト
- ページ上での抽出状況の表示
- 抽出データのハイライト表示

## 技術要件

### 1. 開発環境
- **言語**: JavaScript (ES6+)
- **フレームワーク**: Chrome Extension Manifest V3
- **開発ツール**: Cursor + Chrome DevTools

### 2. アーキテクチャ

#### 2.1 ファイル構成
```
EbayCPaSS2GoogleSheets/
├── manifest.json
├── src/
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   ├── content.js
│   │   └── content.css
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html
│   │   ├── options.js
│   │   └── options.css
│   └── utils/
│       ├── dataExtractor.js
│       ├── csvExporter.js
│       └── googleSheetsApi.js
├── assets/
│   └── icons/
└── tests/
```

#### 2.2 主要コンポーネント

##### Content Script (content.js)
- DOM要素の監視と抽出
- データの前処理
- バックグラウンドスクリプトとの通信

##### Background Script (background.js)
- データの永続化
- Google Sheets API通信の管理
- ポップアップとの通信

##### Popup (popup.js)
- ユーザーインターフェース
- データ表示と操作
- CSV出力機能
- Google Sheets連携機能

### 3. データ抽出ロジック

#### 3.1 DOM監視
```javascript
// 推定送料の抽出
const estimatedCost = document.querySelector('div span.value')?.textContent;

// 追跡番号の抽出
const trackingNumber = document.querySelector('a span:empty')?.parentElement?.textContent?.trim();

// ラストマイル追跡番号の抽出
const lastMileNumber = document.querySelector('span.bold')?.textContent;
```

#### 3.2 データ形式
```javascript
const shippingData = {
  timestamp: new Date().toISOString(),
  pageUrl: window.location.href,
  estimatedCost: {
    amount: parseFloat(costText.match(/[\d,]+\.?\d*/)[0].replace(/,/g, '')),
    currency: costText.match(/[A-Z]{3}/)[0]
  },
  trackingNumber: trackingNumber,
  lastMileTrackingNumber: lastMileNumber,
  status: 'success'
};
```

### 4. Google Sheets連携

#### 4.1 認証設定
- OAuth 2.0個人用認証
- Google Sheets API v4の使用
- 必要なスコープ: `https://www.googleapis.com/auth/spreadsheets`

#### 4.2 スプレッドシート管理
```javascript
// 初回実行時: 新規スプレッドシート作成
const createSpreadsheet = async () => {
  const resource = {
    properties: {
      title: 'ebayCPaSS配送情報 - ' + new Date().toLocaleDateString('ja-JP')
    }
  };
  // スプレッドシート作成とヘッダー設定
};

// データ追記
const appendData = async (data) => {
  const values = [[
    data.timestamp,
    data.estimatedCost.amount + ' ' + data.estimatedCost.currency,
    data.trackingNumber,
    data.lastMileTrackingNumber,
    data.pageUrl,
    data.status
  ]];
  // シートにデータ追記
};
```

## 非機能要件

### 1. パフォーマンス
- データ抽出処理: 1秒以内
- ポップアップ表示: 0.5秒以内
- Google Sheets連携: 3秒以内
- CSV出力: 大量データでも3秒以内

### 2. 信頼性
- DOM変更に対する耐性
- Google Sheets APIエラーハンドリング
- ネットワークエラーハンドリング
- データ整合性の保証

### 3. セキュリティ
- 最小権限の原則
- OAuth認証の適切な実装
- 機密データの暗号化
- CSP準拠

### 4. 使いやすさ
- 直感的なUI
- エラーメッセージの分かりやすさ
- 多言語対応（日本語・英語）

## 制約事項

### 1. 技術的制約
- Chrome Extension Manifest V3の制限
- ebayCPaSSサイトのDOM構造変更への対応
- Google Sheets API制限（1分間100リクエスト）
- 同一オリジンポリシーの制約

### 2. 運用制約
- ebayCPaSSサイトの利用規約遵守
- Google Sheets API利用規約遵守
- 過度なリクエストの制限
- データプライバシーの保護

## 開発スケジュール

### Phase 1: 基本機能開発（2週間）
- データ抽出機能の実装
- 基本UIの作成
- CSV出力機能

### Phase 2: Google Sheets連携開発（1週間）
- Google Sheets API連携機能
- OAuth認証実装
- 設定画面の実装
- エラーハンドリング強化

### Phase 3: テスト・改善（1週間）
- 総合テスト
- パフォーマンス最適化
- ドキュメント整備

## 成功指標

### 1. 機能指標
- データ抽出成功率: 95%以上
- Google Sheets連携成功率: 90%以上
- CSV出力成功率: 100%
- エラー発生率: 5%以下

### 2. ユーザビリティ指標
- 初回利用時の設定完了率: 90%以上
- 継続利用率: 80%以上
- ユーザー満足度: 4.0/5.0以上

## リスク管理

### 1. 技術リスク
- **リスク**: ebayCPaSSサイトのDOM構造変更
- **対策**: 複数のセレクターパターンの準備、定期的な動作確認

### 2. 運用リスク
- **リスク**: Google Sheets APIの制限・変更
- **対策**: レート制限の実装、APIバージョン管理

### 3. データリスク
- **リスク**: 機密データの漏洩
- **対策**: ローカルストレージの暗号化、最小限のデータ保存

## 付録

### A. 参考資料
- Chrome Extension Developer Guide
- Google Sheets API v4 Documentation
- ebayCPaSSサイト構造分析
- 既存プロジェクト（Gmail2Notion、LCchat2notion）の実装パターン

### B. 用語集
- **ebayCPaSS**: eBayセラー向け発送管理サービス
- **ラストマイル**: 配送の最終区間
- **推定送料**: システムが算出した予想配送料金
- **実送料**: 実際に発生した配送料金
- **Google Sheets API**: Googleスプレッドシートを操作するためのAPI 