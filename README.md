# ICASU CDK ECS Fargate Sample

CDK で ECS on Fargate 環境を構築する際のサンプルテンプレートです。以下の用途で活用可能です。

- IaC(AWS CDK)
- ECS on Fargateに必要なインフラ
- CI/CD
- セキュリティ


## インフラ構成概要図

![Architecture Image](packages/docs/images/architecture.jpg)

## 技術スタック

このサンプルでは以下の技術スタックを使用しています。

| 機能 | 技術スタック | 補足|
| - | - | - |
| 言語 | TypeScript| |
| ランタイム| Node.js||
| IaC| AWS CDK||
| テストフレームワーク| Jest ||
| データベース| Amazon Aurora(MySQL) ||
| ORM | [Prisma](https://www.prisma.io/) |
| コンピューティング | AWS ECS on AWS Fargate ||
|フレームワーク| [NestJS](https://nestjs.com/)||
| 認証、ユーザーディレクトリ | Amazon Cognito user pools||
| パッケージマネージャー | [pnpm](https://pnpm.io/ja/) ||
| リンター/フォーマッター | [Biome.js](https://biomejs.dev/ja/) ||
| CI/CD| GitHub Actions | [.github/workflows](.github/workflows) にて実装 |

## Getting Started
### CDK 周りの初期設定

依存関係のを取得
```
$ pnpm install
```

AWS アカウントで cdk bootstrap を未実行の場合、ブートストラップを設定（AWS アカウントで新規に AWS CDK を動かす場合のみ実施）

```
$ pnpm cdk bootstrap --profile {.aws/configに設定したprofile名} -c environment=dev
```

## デプロイまでの流れ

### テンプレート生成

CloudFormation テンプレートを生成して、CDK->CloudFormation の変換がうまくいくかを確認します。

```
pnpm cdk synth -c environment=dev
```

### 変更差分確認

デプロイ内容と実環境との差分を確認したい場合は、cdk diff コマンドを利用する

```
pnpm cdk diff -c environment=dev
```

### AWS 環境へデプロイ

#### デプロイ用のロールとECRのデプロイ

```bash
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query "Account" --output text)
export CDK_DEFAULT_REGION="ap-northeast-1"

cd ./packages/iac

# GHAデプロイ用のロールのデプロイ
pnpm cdk deploy -c environment=dev dev-icasu-ecs-fargate-deploy-role-stack

# ECSを含むスタックは、ECRにコンテナイメージがプッシュ済みである必要があるため先に作成
pnpm cdk deploy -c environment=dev dev-icasu-ecs-fargate-ecr-stack

# 出力結果はこの後の手順で利用するため、セッションをクリアしないこと
```

#### コンテナイメージの用意
```bash
# プロジェクトルートで実行
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
export REPOSITORY_NAME=icasu-ecs-fargate-sample-app
export REGISTRY_NAME=$AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
export COMMIT_HASH=$(git rev-parse --short HEAD)
docker build \
  --platform=linux/x86_64 \
  -t $COMMIT_HASH \
  -f Dockerfile.server .
docker tag $COMMIT_HASH \
  $REGISTRY_NAME/$REPOSITORY_NAME:$COMMIT_HASH

# assume-roleが必要
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin $REGISTRY_NAME
docker push "$AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/$REPOSITORY_NAME:$COMMIT_HASH"
```

#### ECS関連リソースのデプロイ
```bash
cd ./packages/iac
pnpm cdk deploy \
  -c environment=dev \
  -c imageTag=$COMMIT_HASH \
  dev-icasu-ecs-fargate-infra-stack
```

#### 動作確認用の仮ユーザーの作成

```bash
export USER_POOL_ID="<infraスタックデプロイ出力より指定>"
export CLIENT_ID="<infraスタックデプロイ出力より指定>"

export EMAIL="<自分で指定>"
export PASSWORD="<自分で指定>"

# ユーザー作成
aws cognito-idp admin-create-user \
--user-pool-id $USER_POOL_ID \
--username $EMAIL \
--user-attributes Name="email",Value="$EMAIL" Name="email_verified",Value="true" \
--message-action SUPPRESS

export USER_UUID="<前項の出力結果 User.Attributes[0].sub>"

# パスワード設定
aws cognito-idp admin-set-user-password \
--user-pool-id $USER_POOL_ID \
--username $USER_UUID \
--password $PASSWORD \
--permanent

# トークン発行
export AT=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow "ADMIN_USER_PASSWORD_AUTH" \
  --auth-parameters USERNAME=$EMAIL,PASSWORD=$PASSWORD \
  --no-cli-pager | jq -r ".AuthenticationResult.AccessToken")
# 存在を確認
echo $AT
```

#### 動作確認用データを生成
```bash
# リポジトリ直下へ戻りpackages/serverへ移動
cd -
cd ./packages/server
sed -i -e "s/<replace>/$USER_UUID/g" prisma/seed.ts
```

#### Auroraへのポートフォワードプロキシ起動

常駐プロセスのため別シェルを新しく起動した上で実行

```bash
# 別シェルを立てて、assume-roleする
export BASTION_EC2_INSTANCE_ID="<infraスタックデプロイ出力より指定>"
# Auroraのエンドポイントを指定
export MYSQL_ENDPOINT="<infraスタックデプロイ出力より指定>"
export MYSQL_PORT=3307

# ローカル:3307に踏み台EC2の:3306をポートをマッピング
aws ssm start-session \
    --target "$BASTION_EC2_INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "{\"host\":[\"$MYSQL_ENDPOINT\"],\"portNumber\":[\"3306\"], \"localPortNumber\":[\"$MYSQL_PORT\"]}"
```

#### DBマイグレーション(prisma/seed.tsを実行し、テストデータ登録)

常駐プロセスのため別シェルを新しく起動した上で実行

```bash
# 別シェルを立てて、assume-roleする
# packages/server 配下で実行
export USER_NAME="icasu"
export MYSQL_PORT=3307
export PASSWORD="<SecretMangerのaurora-root-secretのpasswordを参照>"
export DATABASE_URL="mysql://$USER_NAME:$PASSWORD@127.0.0.1:$MYSQL_PORT/icasudb"

pnpm prisma generate
pnpm prisma migrate deploy
pnpm prisma db seed
```

#### nestアプリケーションへcurl実行しアプリの動作を確認

すでに起動している`AT`を設定したシェルに戻り、以下コマンドを実行

```bash
export LOAD_BALANCER_DNS_NAME="<infraスタックデプロイ出力より指定>"

curl "http://$LOAD_BALANCER_DNS_NAME/graphql" -H 'Accept-Encoding: gzip, deflate, br' -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'Connection: keep-alive' -H 'DNT: 1' -H 'Origin: http://dev-cx-devcx-o7yzvncdwtin-190078616.ap-northeast-1.elb.amazonaws.com' -H "Authorization: Bearer $AT" --data-binary '{"query":"query {\n  task(id: \"4e5b93e1-b027-4eb7-83ab-f6be67d280cc\") {\n    taskId\n  }\n}\n"}' --compressed

```

## その他

IAM 周りのセキュリティに関連する変更差分確認をスキップしたい場合は、以下のコマンドを使う

```
$ pnpm cdk deploy -c environment=dev --require-approval never
```

### ICASU_NOTE

度々設計判断に迷う部分や躓きやすいポイントに`ICASU_NOTE`というコメントを残しています。
同じような設計を行う場合は、このポイントが考慮できているか参考に確認してください。
以下のコマンドで`ICASU_NOTE`をまとめて確認できるので、構築前後にチェックしてみてください。（Mac/Linuxのみ）

```
% find ./ -type f -not -regex ".*/node_modules/.*" -exec grep -H "ICASU_NOTE:" {} \; | cut -d ':' -f1,3
```

## 使用上の注意

### cdk.context.json
サンプルコード開発用の環境設定をコミットしないため `.gitignore`ファイルで`cdk.context.json`はコミット対象外としている。通常の開発ではコミットが必要なため、開発時に`cdk.context.json`の行は削除すること

参考: https://docs.aws.amazon.com/cdk/v2/guide/context.html
意訳：cdk.json と cdk.context.json はアプリケーションの状態の一部なので、アプリケーションのソースコードと一緒にリポジトリにコミットする必要があります。


### ORMの技術選定

Prismaを使っていますがあくまでAurora接続確認用途です。新規案件は以下も検証してみることを推奨します。

* ORM系
  * [TypeORM](https://typeorm.io/)
  * [drizzle-orm](https://github.com/drizzle-team/drizzle-orm)
* クエリビルダ系
  * [kysely](https://github.com/kysely-org/kysely)

### 静的解析/コードフォーマットの技術選定

`biomejs`を利用しております。eslintとどちらを使うかは、以下の観点で導入検討してください。

* eslintの静的解析で時間がかかっており、速度を上げたい場合
* 簡易な設定で高速な静的解析/コードフォーマットを導入したい場合
* eslintやprettierでカスタムプラグインを利用する予定が無い場合

また以下のルールに関しては、errorにしてください。現状ICASUでは作成途中のためwarnにしております。

* lint/correctness/noUnusedVariables
* lint/suspicious/noExplicitAny

## 運用

### Auroraへ接続

ローカルにSSM Manager Pluginがない場合は、[手順](https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)からインストール

踏み台とローカルのポートをフォワードするプロキシの起動

```bash
# 踏み台サーバーのEC2インスタンスIDを取得
export BASTION_EC2_INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=BastionHost" --query "Reservations[*].Instances[*].InstanceId" --output text)
# Auroraのエンドポイントを指定
export MYSQL_ENDPOINT=""
export MYSQL_PORT=3307
aws ssm start-session \
    --target "$BASTION_EC2_INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "{\"host\":[\"$MYSQL_ENDPOINT\"],\"portNumber\":[\"3306\"], \"localPortNumber\":[\"$MYSQL_PORT\"]}"
```

セッションへログイン(対話型でSecretMangerにあるパスワードを入力する)

```bash
mysql -u icasu -p -h 127.0.0.1 -P 3307 --local_infile=1 -D icasudb
```

## 貢献について

現在本リポジトリは、クラスメソッド内部のミラーとして機能しています。

今後PRやISSUE受け入れを検討しており準備している段階です。フィードバックがありましたら、[tmk2154](https://x.com/tmk2154), [shuntaka_jp](https://x.com/shuntaka_jp)までお願いします。
