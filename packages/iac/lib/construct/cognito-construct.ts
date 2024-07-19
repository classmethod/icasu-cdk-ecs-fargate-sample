import { aws_cognito } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface CognitoConstructProps {
  domainPrefix: string;
  callbackUrls: string[];
  logoutUrls: string[];
  addClientForE2ETest: boolean;
  envName: string;
  projectName: string;
}

export class CognitoConstruct extends Construct {
  public readonly userPool: aws_cognito.UserPool;
  public readonly userPoolClient: aws_cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);

    const { domainPrefix, callbackUrls, logoutUrls, addClientForE2ETest } =
      props;

    this.userPool = new aws_cognito.UserPool(this, `${id}-UserPool`, {
      userPoolName: props.projectName,
      signInAliases: {
        email: true, // サインインIDにユーザーネームではなくメールアドレスを使用する
      },
      deletionProtection: true, // 誤削除防止
      mfa: aws_cognito.Mfa.OPTIONAL, // MFA を任意で有効化可能とする
    });

    this.userPool.addDomain(`${id}-UserPoolDomain`, {
      cognitoDomain: { domainPrefix: domainPrefix },
    });

    this.userPoolClient = this.userPool.addClient(`${id}-UserPoolClient`, {
      userPoolClientName: props.projectName,
      generateSecret: false,
      authFlows: {
        // 動作確認
        adminUserPassword: props.envName === 'dev',
      },
      oAuth: {
        callbackUrls: callbackUrls,
        logoutUrls: logoutUrls,
        flows: { authorizationCodeGrant: true }, // 大抵のケースでは authorizationCodeGrant のみ有効化すれば良い。既定では implicitCodeGrant フローが有効になっているため、無効化する。
        scopes: [
          // 既定値には必要以上のスコープが含まれているため、必要最小限のスコープを指定する
          aws_cognito.OAuthScope.EMAIL,
          aws_cognito.OAuthScope.PROFILE,
          aws_cognito.OAuthScope.OPENID,
        ],
      },
    });

    // E2E テスト用クライアント
    if (addClientForE2ETest) {
      this.userPool.addClient(`${id}-UserPoolClientForE2ETest`, {
        userPoolClientName: `${props.projectName}E2EClient`,
        generateSecret: false,
        oAuth: {
          callbackUrls: callbackUrls,
          logoutUrls: logoutUrls,
          flows: { authorizationCodeGrant: true },
          scopes: [
            aws_cognito.OAuthScope.EMAIL,
            aws_cognito.OAuthScope.PROFILE,
            aws_cognito.OAuthScope.OPENID,
          ],
        },
        authFlows: { adminUserPassword: true }, // 管理者権限でユーザーの ID トークンを取得可能とするため有効化
      });
    }
  }
}
