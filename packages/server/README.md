# server

NestJSのサンプルアプリです。

## ローカル開発

### 型定義ファイルの生成

```bash
pnpm ts-node ./bin/generate-typings.ts
```

### データベース構築

ローカル開発ではデータベースにMySQLコンテナを利用します。初回コンテナ作成時は、mysqld.cnf の`autocommit=1`に設定した上で実行する。

コンテナの構築
```bash
finch compose up -d

# passwordなしでセッションに入れることを確認
mysql -u root -p -h 127.0.0.1 -P 3306 --local_infile=1
```

```bash
export USER_NAME="root"

export MYSQL_ENDPOINT="127.0.0.1"
export MYSQL_PORT="3306"
export DATABASE_URL="mysql://$USER_NAME:@$MYSQL_ENDPOINT:$MYSQL_PORT/icasudb"

npx prisma migrate dev
```

### アプリケーション起動

infraスタックデプロイ後のCfnOutputを元に、env.devの以下の2つの値を記載

* COGNITO_USERPOOL_ID
* COGNITO_CLIENT_ID

```bash
pnpm dotenv -e ./.env.dev -- nest start --watch
```


### コンテナ手動ビルド

```bash
# プロジェクトルートで実施
finch build --platform=linux/x86_64 -f Dockerfile.server .
```
