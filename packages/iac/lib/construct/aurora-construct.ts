import type * as cdk from 'aws-cdk-lib';
import { Duration, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_rds as rds } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AuroraConstructProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  envName: string;
  projectName: string;
  allowInboundSecurityGroups: ec2.SecurityGroup[];
  database: {
    defaultDatabaseName: string;
    databaseRootUserName: string;
  };
}

export class AuroraConstruct extends Construct {
  public readonly dbRootSecret: secretsmanager.Secret;
  public readonly cluster: rds.DatabaseCluster;
  public readonly bationHostEc2: ec2.BastionHostLinux;

  constructor(scope: Construct, id: string, props: AuroraConstructProps) {
    super(scope, id);
    // 踏み台+セッションマネージャーを使った接続設定
    const securityGroupForBastion = new ec2.SecurityGroup(
      this,
      `${id}-bastion-ec2-for-aurora`,
      {
        vpc: props.myVpc,
        allowAllOutbound: true,
      }
    );
    this.bationHostEc2 = new ec2.BastionHostLinux(this, `${id}-bastion-host`, {
      vpc: props.myVpc,
      subnetSelection: {
        subnetGroupName: 'Protected',
      },
      securityGroup: securityGroupForBastion,
      machineImage: ec2.MachineImage.genericLinux({
        // MEMO: LatestのAMIが変更されることによるBastion再作成を防ぐため、明示的に指定。
        'ap-northeast-1': 'ami-0dafcef159a1fc745', // TODO: 利用時に適切なリージョン、AMIを指定する
      }),
    });

    // Aurora用セキュリティグループを作成
    // クラスターエンドポイント経由でアクセスするため特定接続先の設定は存在しない
    const securityGroupForAurora = new ec2.SecurityGroup(
      this,
      `${id}-aurora-security-group`,
      {
        vpc: props.myVpc,
        allowAllOutbound: false,
      }
    );
    // 特定SecurityGroupがアタッチされたリソースから、Auroraへのインバウンドアクセスを許可する設定
    props.allowInboundSecurityGroups.map((sg) =>
      securityGroupForAurora.addIngressRule(sg, ec2.Port.tcp(3306))
    );
    securityGroupForAurora.addEgressRule(
      ec2.Peer.ipv4('127.0.0.1/32'),
      ec2.Port.allTcp()
    );

    // ルートユーザーの接続情報を生成(username, passwordのみ)
    this.dbRootSecret = new secretsmanager.Secret(this, `${id}-aurora-secret`, {
      secretName: `aurora-root-secret`,
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
        secretStringTemplate: JSON.stringify({
          username: props.database.databaseRootUserName,
        }),
      },
    });

    const auroraEngineVersion = rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.VER_3_04_0,
    });

    this.cluster = new rds.DatabaseCluster(this, `${id}-aurora`, {
      credentials: rds.Credentials.fromSecret(this.dbRootSecret), // host, dbnameの追加
      engine: auroraEngineVersion,
      writer: rds.ClusterInstance.serverlessV2(`${id}-aurora-writer`, {
        publiclyAccessible: false,
        caCertificate: rds.CaCertificate.RDS_CA_RDS4096_G1,
      }),
      readers:
        // 開発環境はレプリケーションしない
        props.envName === 'dev'
          ? []
          : [
              // scaleWithWriterは、フェイルオーバーが起きた際にライターに追従してスケールアップする設定
              rds.ClusterInstance.serverlessV2(`${id}-aurora-reader`, {
                scaleWithWriter: true,
                publiclyAccessible: false,
                caCertificate: rds.CaCertificate.RDS_CA_RDS4096_G1,
              }),
            ],
      serverlessV2MaxCapacity: 2.0,
      serverlessV2MinCapacity: 0.5,
      backup: {
        retention: Duration.days(7),
        preferredWindow: '15:00-15:30',
      },
      vpc: props.myVpc,
      defaultDatabaseName: props.database.defaultDatabaseName,
      vpcSubnets: props.myVpc.selectSubnets({ subnetGroupName: 'Protected' }),
      parameterGroup: new rds.ParameterGroup(
        this,
        `${id}-aurora-parameters-group`,
        {
          engine: auroraEngineVersion,
          parameters: {
            autocommit: '1', // フレームワークや要件によって判断
            sql_mode: 'TRADITIONAL,NO_AUTO_VALUE_ON_ZERO,ONLY_FULL_GROUP_BY',
            general_log: '1', // クエリログの出力設定
            slow_query_log: '1', // 時間のかかるクエリログの出力設定
            long_query_time: '2', // 指定時間(s)以上の場合、slow_query_logに出力設定
            character_set_server: 'utf8mb4',
            character_set_client: 'utf8mb4',
            transaction_isolation: 'READ-COMMITTED', // デフォルトはREPEATABLE-READ. 要件によって判断
            server_audit_logging: '1', // 監査ログ
            server_audit_events: 'CONNECT,QUERY,TABLE', // 出力する監査ログの種類
          },
        }
      ),
      cloudwatchLogsExports: ['audit', 'error', 'general', 'slowquery'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_YEAR,
      preferredMaintenanceWindow: 'Sat:17:00-Sat:17:30',
      storageEncrypted: true,
    });

    this.cluster.connections.allowFrom(
      securityGroupForBastion,
      ec2.Port.tcp(3306)
    );
    // FargateのSecurityGroupも許可する
    props.allowInboundSecurityGroups.map((sg) =>
      this.cluster.connections.allowFrom(sg, ec2.Port.tcp(3306))
    );
  }
}
