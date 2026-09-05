# eBay APIをVercelへ接続する手順

1. VercelでGitHubリポジトリ `mina200112051119-sys/export-profit-finder` をImportします。
2. Root Directoryはリポジトリのルートのままにします。
3. Deployします。
4. VercelのProject Settings → Environment Variablesで次の2つをProductionに登録します。
   - `EBAY_CLIENT_ID`
   - `EBAY_CLIENT_SECRET`
5. 保存後にProductionへ再デプロイします。
6. API URLは `https://<Vercelのドメイン>/api/ebay-search?q=Pokemon%20151%20Charizard` です。

秘密情報はGitHubやHTMLには書きません。Vercelの環境変数に登録します。
