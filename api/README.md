# eBay / 為替 API 接続部分

Export Profit Finder のサーバー側コードです。

## eBay API

必要な環境変数:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

eBay Browse APIはApplication access tokenを使って商品検索します。秘密情報はHTMLやGitHub Pages側には置きません。

API:

`GET /api/ebay-search?q=Pokemon%20151%20Charizard`

候補商品のタイトル・USD価格・送料・画像・eBay URLと、取得価格の最安/中央値/最高値を返します。

## 為替 API

`GET /api/fx`

USD/JPYの最新レートをサーバー側で取得して返します。ブラウザ側にAPIキーを置く必要はありません。

## 手数料について

eBayの手数料は出品先、カテゴリー、ストア契約、販売条件などで変わります。そのため、固定した数字をアプリに埋め込まず、今後はサーバー側で手数料ルールを管理し、更新できる設計にします。

## 注意

これらのAPIを動かすにはVercelなどのサーバー実行環境へデプロイして、eBayの環境変数を設定する必要があります。GitHub PagesはHTMLを配信するだけなので、サーバーコード自体はGitHub Pages上では実行されません。
