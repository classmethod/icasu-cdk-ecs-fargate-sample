import * as cdk from 'aws-cdk-lib';
import { DeployRoleStack } from '../lib/deploy-role-stack';
import { EcrStack } from '../lib/ecr-stack';
import { InfraStack } from '../lib/infra-stack';
import { getAppParameters } from './parameter';

const app = new cdk.App();

const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
const appParameter = getAppParameters(envKey);

/**
 * ICASU_NOTE: 各環境のパラメータをcdk.jsonで管理するか、TypeScript化するか
 * ・TypeScript化する
 *   メリット：型定義が使えるので初期構築時のミスを減らせる
 * ・cdk.jsonの場合
 *   メリット：公式の方法なのでPJ移動時の読み手への負荷が低い
 */

// MEMO: cdk.jsonで管理する場合の実装例
// const envKey = app.node.tryGetContext(argContext);
// if (envKey === undefined) {
//   throw new Error(
//     `環境名を指定してください。 ex) cdk deploy -c ${argContext}=dev`
//   );
// }
// const appParameter = app.node.tryGetContext(envKey);
// if (appParameter === undefined)
//   throw new Error(`${envKey}の環境設定がcdk.jsonに含まれていません`);
// const getEnv = () => {
//   return {
//     env: appParameter.env,
//     envName: appParameter.envName,
//     projectName: projectName,
//   };
// };

/**
 * ICASU_NOTE: スタックのIDの命名規則。リテラルでPJ名などを含むか固定値にするか検討
 * ・リテラル
 *   メリット：1AWSアカウントを複数人で使う場合、envNameを個別に切り替えるだけでリソースが競合しない
 *   デメリット：ConstructのIDにidを流用しリソース名を自動生成する場合、リソース名が長く読み辛くなる
 * ・固定
 *   メリット：リソース名が長くなりにくい。リソースをコンソール上で確認しやすい
 *   デメリット：複数人開発の場合、リソース名が重複するリソースがある（Aurora、WAFなど）
 */

/**
 * ICASU_NOTE: スタックの分割粒度の検討
 * 必要がないなら分けない！Constructを使って構造化する方がおすすめ
 * [AWS CDK Tips: スタックの分け方について]{@link https://tmokmss.hatenablog.com/entry/20221121/1669032738}
 * [AWS CDK Tips: コンストラクトで構造化しよう]{@link https://tmokmss.hatenablog.com/entry/20221212/1670804620}
 *
 * RDSなどステートフルなリソースだけはデプロイサイクルから分けたい場合のみ検討
 * スタック分割参考：[デプロイ要件に応じて、アプリケーションのStageを複数のStackに分割する]{@link https://aws.amazon.com/jp/blogs/news/best-practices-for-developing-cloud-applications-with-aws-cdk/}
 */

/**
 * ICASU_NOTE: スタックを分割する際に、スタック間のリソースの受け渡しにするか検討
 * props渡しによるスタック間参照の弊害を避けるため、SSM ParameterStore経由、もしくは固定リソース名やArnでリソースを受け渡すことを推奨
 * [CDKでスタック間のパラメーターを受け渡す5つの方法とケース別の最適解について考えてみた]{@link https://dev.classmethod.jp/articles/best-way-to-reference-parameters-in-cdk/}
 * [AWS CDKのProps渡しのクロススタック参照で起きる問題と対処方法]{@link https://dev.classmethod.jp/articles/aws-cdk-props-cross-stack-reference-problem-and-handle/}
 *
 */

/**
 * Build Container Image
 * デプロイパイプラインからタグの指定がある場合は、優先して使用する
 */
const imageTag = app.node.tryGetContext('imageTag')
  ? app.node.tryGetContext('imageTag')
  : appParameter.imageTag;

new DeployRoleStack(
  app,
  `${appParameter.envName}-${appParameter.projectName}-deploy-role-stack`,
  {
    projectName: appParameter.projectName,
    gitHubOwner: appParameter.github.owner,
    gitHubRepo: appParameter.github.repo,
  }
);

new EcrStack(
  app,
  `${appParameter.envName}-${appParameter.projectName}-ecr-stack`,
  {
    repositoryName: appParameter.repositoryName,
    envName: appParameter.envName,
    projectName: appParameter.projectName,
  }
);

new InfraStack(
  app,
  `${appParameter.envName}-${appParameter.projectName}-infra-stack`,
  {
    vpcCidr: appParameter.vpcCidr,
    vpcIdSsmParamName: appParameter.vpcIdSsmParamName,
    repositoryName: appParameter.repositoryName,
    imageTag: imageTag,
    webAclScope: 'REGIONAL',
    taskCpu: appParameter.taskCpu,
    taskMemory: appParameter.taskMemory,
    containerCpu: appParameter.containerCpu,
    containerMemory: appParameter.containerMemory,
    // TODO: HTTPS対応
    certificateArn: 'TBD',
    domainPrefix: appParameter.domainPrefix,
    callbackUrls: appParameter.callbackUrls,
    logoutUrls: appParameter.logoutUrls,
    envName: appParameter.envName,
    projectName: appParameter.projectName,
    env: {
      account: appParameter.env.account,
      region: appParameter.env.region,
    },
  }
);
