# ebayCPaSS2GoogleSheets - 配送情報抽出拡張機能

ebayCPaSSサイトから配送情報を自動抽出し、Google Sheetsに保存するChrome拡張機能です。

## 機能

- **推定送料の抽出**: サイトに表示される推定送料を自動取得
- **追跡番号の抽出**: 配送の追跡番号を自動取得
- **ラストマイル追跡番号の抽出**: 最終配送区間の追跡番号を自動取得
- **CSV出力**: 抽出したデータをCSV形式でダウンロード
- **Google Sheets連携**: 抽出データをGoogle Sheetsスプレッドシートに自動保存

## 抽出対象データ

### 推定送料
```html
<div><span class="value">2,486.00 JPY</span></div>
```

### 追跡番号
```html
<a><span>&nbsp;</span>EM1013071241398FE06040099C0N</a>
```

### ラストマイル追跡番号
```html
<span class="bold">882312169260</span>
```

## Google Sheetsシート構造

| 列 | 項目 | 例 |
|---|---|---|
| A | 抽出日時 | 2024-01-15 14:30:25 |
| B | 推定送料 | 2,486.00 JPY |
| C | 追跡番号 | EM1013071241398FE06040099C0N |
| D | ラストマイル追跡番号 | 882312169260 |
| E | ページURL | https://... |
| F | 抽出ステータス | 成功 |

## インストール

1. このリポジトリをクローンまたはダウンロード
2. Chromeブラウザで `chrome://extensions/` にアクセス
3. 「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. ダウンロードした `EbayCPaSS2GoogleSheets` フォルダを選択

## 使用方法

1. ebayCPaSSサイトにアクセス
2. 拡張機能アイコンをクリック
3. 「データ抽出」ボタンをクリック
4. 抽出されたデータを確認
5. 必要に応じてCSV出力またはGoogle Sheets保存を実行

## 設定

### Google Sheets連携設定
1. 拡張機能の設定画面を開く
2. Google アカウントでOAuth認証を実行
3. 対象スプレッドシートIDを設定（初回は自動作成）
4. 自動保存設定を有効化

### 初回セットアップ
1. **Google Cloud Console**でプロジェクトを作成
2. **Google Sheets API**を有効化
3. **OAuth 2.0認証情報**を作成
4. 拡張機能にクライアントIDを設定

## 開発

### 必要な環境
- Node.js 16以上
- Chrome ブラウザ
- Google Cloud Console アカウント

### 開発手順
1. リポジトリをクローン
2. 依存関係をインストール（必要に応じて）
3. Google Sheets API設定を完了
4. コードを編集
5. Chromeの拡張機能管理画面で「更新」をクリック

### ファイル構成
```
EbayCPaSS2GoogleSheets/
├── manifest.json              # 拡張機能の設定
├── src/
│   ├── background/
│   │   └── background.js      # バックグラウンドスクリプト
│   ├── content/
│   │   ├── content.js         # コンテンツスクリプト
│   │   └── content.css        # コンテンツスタイル
│   ├── popup/
│   │   ├── popup.html         # ポップアップUI
│   │   ├── popup.js           # ポップアップロジック
│   │   └── popup.css          # ポップアップスタイル
│   ├── options/
│   │   ├── options.html       # 設定画面
│   │   ├── options.js         # 設定ロジック
│   │   └── options.css        # 設定スタイル
│   └── utils/
│       ├── dataExtractor.js   # データ抽出ユーティリティ
│       ├── csvExporter.js     # CSV出力ユーティリティ
│       └── googleSheetsApi.js # Google Sheets API連携
├── assets/
│   ├── icons/                 # アイコン画像
│   └── images/                # その他画像
├── docs/                      # ドキュメント
└── tests/                     # テストファイル
```

## API制限

- **Google Sheets API**: 1分間に100リクエスト
- **データ保存**: 1回の操作で最大1000行まで

## ライセンス

MIT License

## 貢献

バグ報告や機能要求は、GitHubのIssuesからお願いします。

## 注意事項

- この拡張機能は、ebayCPaSSサイトの利用規約に従って使用してください
- Google Sheets APIの利用規約に従って使用してください
- サイトの構造変更により、データ抽出が正常に動作しない場合があります
- 機密情報の取り扱いには十分注意してください
- OAuth認証情報は適切に管理してください 