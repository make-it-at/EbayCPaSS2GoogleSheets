# ebayCPaSS2GoogleSheets Chrome Extension

eBay CPaSS (Commercial Platform as a Service) サイトから配送情報を抽出し、Google Sheetsに保存するChrome拡張機能です。

## 機能

### 主要機能
- **配送情報の自動抽出**: 推定送料、追跡番号、ラストマイル追跡番号
- **Google Sheets連携**: OAuth 2.0認証によるセキュアなデータ保存
- **CSV エクスポート**: 抽出データのCSV形式でのエクスポート
- **クリップボード機能**: ワンクリックでデータをクリップボードにコピー
- **履歴管理**: 抽出履歴の管理と検索

### 新機能
- **個別商品ボタン**: 各商品に個別の操作ボタンを表示
- **設定ページ**: 拡張機能の動作を詳細にカスタマイズ
- **API エラー監視**: eBay APIエラーの検出と対応

## API エラー対応

### 概要
eBay CPaSS サイトでは、時々内部APIエラーが発生します（例：400 Bad Request）。この拡張機能は、このようなエラーを検出し、適切に対応します。

### エラー検出機能
- **リアルタイム監視**: XMLHttpRequest と Fetch API のエラーを監視
- **コンソールエラー監視**: JavaScript エラーの検出
- **API状態追跡**: エラー状態の継続的な監視

### エラー時の動作
1. **通知表示**: APIエラーが検出されると、専用の警告通知を表示
2. **フォールバック抽出**: APIエラー時でも、ページ上の表示データから情報を抽出
3. **継続監視**: ページ変更時にエラー状態をリセット

### 対応するエラー
- `400 Bad Request`: リクエストが無効
- `401 Unauthorized`: 認証エラー
- `500+ Server Error`: サーバーエラー
- ネットワークエラー
- JavaScript実行エラー

## インストール

1. このリポジトリをクローンまたはダウンロード
2. Chrome で `chrome://extensions/` を開く
3. 「デベロッパー モード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. プロジェクトフォルダを選択

## 使用方法

### 基本的な使用方法
1. eBay CPaSS サイトにアクセス
2. 配送情報が表示されているページで拡張機能を使用
3. ボタンをクリックして情報を抽出・コピー

### 設定方法
1. 拡張機能のアイコンをクリック
2. 「設定」ボタンをクリック
3. 各種設定を調整：
   - ボタンの表示/非表示
   - ボタンの位置
   - 個別/グローバルボタンモード
   - 履歴保持期間

## 技術仕様

### 対応データ形式
- **推定送料**: "2,486.00 JPY" 形式
- **追跡番号**: "EM1013071241398FE06040099C0N" 形式
- **ラストマイル追跡番号**: "882312169260" 形式

### ブラウザ対応
- Chrome 88+
- Chromium ベースのブラウザ

### セキュリティ
- OAuth 2.0 認証
- 最小権限の原則
- セキュアなデータ送信

## 開発

### 開発環境
```bash
# 依存関係のインストール
npm install

# 開発モード
npm run dev

# ビルド
npm run build
```

### ファイル構成
```
src/
├── manifest.json       # 拡張機能マニフェスト
├── popup/             # ポップアップUI
├── content/           # コンテンツスクリプト
├── background/        # バックグラウンドスクリプト
└── options/           # 設定ページ
```

## トラブルシューティング

### よくある問題

#### ボタンが表示されない
1. 設定で「サイトにボタンを表示」が有効になっているか確認
2. ページを再読み込み
3. 拡張機能を無効/有効にして再試行

#### データが抽出できない
1. APIエラー通知が表示されていないか確認
2. ページが完全に読み込まれるまで待機
3. 手動でデータ抽出を試行

#### Google Sheets連携エラー
1. OAuth認証を再実行
2. Google Sheets APIの権限を確認
3. ネットワーク接続を確認

### デバッグ方法
1. Chrome DevTools を開く
2. Console タブでエラーメッセージを確認
3. 拡張機能のログを確認

## ライセンス

MIT License - 詳細は LICENSE ファイルを参照

## 貢献

プルリクエストやイシューの報告を歓迎します。

## 更新履歴

### v1.2.0
- API エラー監視機能を追加
- 個別商品ボタン機能を追加
- 設定ページを強化
- エラー通知システムを改善

### v1.1.0
- Google Sheets連携機能を追加
- CSV エクスポート機能を追加
- 履歴管理機能を追加

### v1.0.0
- 初回リリース
- 基本的な配送情報抽出機能 