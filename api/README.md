# eBay API 接続部分

Export Profit Finder のeBay相場取得用サーバー側コードです。

## 必要な環境変数

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

eBay Browse APIはApplication access tokenを使って商品検索します。秘密情報はHTMLやGitHub Pages側には置きません。

## API

`GET /api/ebay-search?q=Pokemon%20151%20Charizard`

返却内容には、候補商品のタイトル・USD価格・送料・画像・eBay URLと、取得価格の最安/中央値/最高値を含みます。

## 注意

このAPIを動かすには、Vercelなどのサーバー実行環境へデプロイして環境変数を設定する必要があります。GitHub PagesはHTMLを配信するだけなので、このサーバーコード自体はGitHub Pages上では実行されません。
