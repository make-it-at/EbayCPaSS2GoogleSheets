# Chrome Web Store Listing - ebayCPaSS2GoogleSheets

## 基本情報

### 拡張機能名
**日本語**: ebayCPaSS2GoogleSheets
**英語**: ebayCPaSS2GoogleSheets

### 概要（短い説明）
**日本語**: ebayCPaSSサイトから配送情報を自動抽出し、Google Sheetsに保存するツール
**英語**: Automatically extract shipping data from ebayCPaSS website and save to Google Sheets

### 詳細説明

**日本語版**:
```
ebayCPaSS2GoogleSheetsは、eBayセラー向けの配送管理サイト「ebayCPaSS」から重要な配送情報を自動的に抽出し、Google Sheetsスプレッドシートに保存するChrome拡張機能です。

主な機能：
✅ 推定送料の自動抽出
✅ 追跡番号の自動取得
✅ ラストマイル追跡番号の抽出
✅ 抽出データのCSV出力
✅ Google Sheetsとの自動連携
✅ データの重複チェック機能
✅ 直感的なユーザーインターフェース

Google Sheets連携：
- 初回実行時に専用スプレッドシートを自動作成
- 以降は同じシートにデータを自動追記
- OAuth認証による安全な連携
- リアルタイムでのデータ同期

対象ユーザー：
- eBayセラー
- ebayCPaSSを利用している配送業者
- 配送コスト管理を効率化したい方
- データ分析にGoogle Sheetsを活用したい方

使用方法：
1. Google アカウントでOAuth認証
2. ebayCPaSSサイトにアクセス
3. 拡張機能アイコンをクリック
4. 「データ抽出」ボタンでワンクリック抽出
5. 自動的にGoogle Sheetsに保存

プライバシー保護：
- OAuth認証による安全なGoogle連携
- データはユーザーのGoogle Sheetsにのみ保存
- 最小限の権限のみを要求
- 機密情報の適切な管理

注意事項：
- ebayCPaSSサイトでのみ動作します
- Google Sheets APIの利用制限があります
- 利用規約に従ってご使用ください
```

**英語版**:
```
ebayCPaSS2GoogleSheets is a Chrome extension designed to automatically extract important shipping information from the ebayCPaSS website and save it to Google Sheets spreadsheets.

Key Features:
✅ Automatic extraction of estimated shipping costs
✅ Automatic retrieval of tracking numbers
✅ Last-mile tracking number extraction
✅ CSV export of extracted data
✅ Automatic Google Sheets integration
✅ Duplicate data detection
✅ Intuitive user interface

Google Sheets Integration:
- Automatically creates dedicated spreadsheet on first run
- Automatically appends data to the same sheet thereafter
- Secure integration via OAuth authentication
- Real-time data synchronization

Target Users:
- eBay sellers
- Shipping companies using ebayCPaSS
- Anyone looking to streamline shipping cost management
- Users who want to utilize Google Sheets for data analysis

How to Use:
1. Authenticate with Google account via OAuth
2. Access the ebayCPaSS website
3. Click the extension icon
4. Click "Extract Data" for one-click extraction
5. Automatically saves to Google Sheets

Privacy Protection:
- Secure Google integration via OAuth authentication
- Data is stored only in user's Google Sheets
- Requests minimal permissions only
- Proper handling of sensitive information

Important Notes:
- Works only on ebayCPaSS website
- Subject to Google Sheets API limitations
- Please use in accordance with terms of service
```

## カテゴリ
- **プライマリ**: 仕事効率化
- **セカンダリ**: 開発者ツール

## タグ
- ebayCPaSS
- eBay
- Google Sheets
- shipping
- data extraction
- CSV export
- productivity
- automation
- OAuth
- 配送管理
- データ抽出

## スクリーンショット

### 1. メインポップアップ画面
- 抽出ボタンとデータ表示エリア
- Google Sheets連携ボタン
- 清潔で直感的なインターフェース

### 2. データ抽出結果画面
- 抽出された配送情報の表示
- CSV出力とGoogle Sheets保存オプション

### 3. 設定画面
- Google OAuth認証設定
- スプレッドシートID設定
- 自動抽出設定

### 4. Google Sheetsでの結果表示
- 抽出されたデータの表示
- 構造化されたシート形式

### 5. ebayCPaSSサイトでの動作
- データ抽出中のハイライト表示
- 抽出完了通知

## プライバシーポリシー

### データ収集
- 個人情報は収集しません
- 配送データはユーザーのGoogle Sheetsにのみ保存
- 外部サーバーへのデータ送信は行いません

### 権限の使用
- **activeTab**: 現在のタブの情報取得（データ抽出のため）
- **storage**: 設定とデータの保存（ローカルストレージ）
- **downloads**: CSV出力機能（ファイルダウンロード）
- **identity**: Google OAuth認証（Google Sheets連携のため）

### 第三者サービス
- Google Sheets API（OAuth認証による安全な連携）
- 他の第三者サービスとの連携はありません

## サポート情報

### 対応ブラウザ
- Google Chrome 88以降
- Chromium系ブラウザ（Edge、Brave等）

### 対応サイト
- ebayCPaSS (*.ebaycpass.com)

### API制限
- Google Sheets API: 1分間に100リクエスト
- データ保存: 1回の操作で最大1000行

### サポート連絡先
- GitHub Issues: [リポジトリURL]
- Email: [サポートメール]

### FAQ
1. **Q**: データが抽出されない
   **A**: ページが完全に読み込まれてから再試行してください

2. **Q**: Google Sheets連携ができない
   **A**: OAuth認証が正しく完了しているか確認してください

3. **Q**: CSV出力ができない
   **A**: ブラウザのダウンロード設定を確認してください

4. **Q**: スプレッドシートが作成されない
   **A**: Google Sheets APIの権限を確認してください

## 更新履歴

### v1.0.0
- 初回リリース
- 基本的なデータ抽出機能
- CSV出力機能
- Google Sheets連携機能
- OAuth認証実装

## 開発者情報

### 開発者名
[開発者名]

### 連絡先
[連絡先情報]

### その他の拡張機能
- Gmail2Notion
- LCchat2notion
- Mercari2Notion 