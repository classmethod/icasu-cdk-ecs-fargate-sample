import * as cdk from 'aws-cdk-lib';

import type { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import type { aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import type { aws_cognito as cognito } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface EcsConstructProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  webAcl: wafv2.CfnWebACL;
  taskCpu: number;
  taskMemory: number;
  containerCpu: number;
  containerMemory: number;
  repositoryName: string;
  imageTag: string;
  ecsSecurityGroup: ec2.SecurityGroup;
  albSecurityGroup: ec2.SecurityGroup;
  // FIXME: Rootで接続は非推奨。一旦構築手順簡略化ためRootを利用
  // TODO: Rootと同じ要領でSecretを生成し、MySQLコマンドでそのユーザーへ権限を付与する
  dbRootSecret: secretsmanager.Secret;
  certificateArn: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  envName: string;
  projectName: string;
}

export class EcsConstruct extends Construct {
  public readonly loadBalancerDnsName: string;

  constructor(scope: Construct, id: string, props: EcsConstructProps) {
    super(scope, id);
    /**
     * --- Application LoadBalancer ---
     * {@link  https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions}
     */
    const albLogBucket = new s3.Bucket(this, `${id}-AlbLogBucket`, {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ALB for App Server
    const albForApp = new elbv2.ApplicationLoadBalancer(this, `${id}-Alb`, {
      vpc: props.myVpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Public',
      }),
    });

    this.loadBalancerDnsName = albForApp.loadBalancerDnsName;

    // Enable ALB Access Logging
    albForApp.setAttribute('access_logs.s3.enabled', 'true');
    albForApp.setAttribute('access_logs.s3.bucket', albLogBucket.bucketName);
    albForApp.logAccessLogs(albLogBucket);

    /**
     * --- ECS Exec ---
     * ECS Execution Role と Task Role の違い
     * {@link  https://www.karakaram.com/difference-between-ecs-task-role-and-task-execution-role/}
     */

    // Roles
    const executionRole = new iam.Role(this, `${id}-EcsTaskExecutionRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy'
        ),
      ],
    });
    const serviceTaskRole = new iam.Role(this, `${id}-EcsServiceTaskRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'),
      ],
    });

    // --- Fargate Cluster ---
    // ECS Task
    // CPU、Memoryは、タスク、AWS環境ごとに異なるため cdk.json から注入する
    const serviceTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      `${id}-ServiceTaskDefinition`,
      {
        // TODO: Grouping Task Definition
        // family: "ServiceName",
        cpu: props.taskCpu,
        memoryLimitMiB: props.taskMemory,
        executionRole: executionRole,
        taskRole: serviceTaskRole,
      }
    );

    const logGroup = new logs.LogGroup(this, `${id}-ServiceLogGroup`, {
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    serviceTaskDefinition
      .addContainer('api', {
        image: ecs.ContainerImage.fromEcrRepository(
          ecr.Repository.fromRepositoryName(
            this,
            `${id}-RepositoryName`,
            props.repositoryName
          ),
          props.imageTag
        ),
        /**
         * MEMO: コンテナのmemoryLimitMiB, memoryReservationMiB を設定する場合、memoryLimitMiB（ハードリミット）とmemoryReservationMiB（ソフトリミット）は両方MAX値に設定するとメモリ使用量が100%付近に達してもコンテナが落ちず、処理速度の低下したコンテナが残り続ける。
         */
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: `samplePrefixName`,
          logGroup,
        }),
        secrets: {
          DB_HOST: ecs.Secret.fromSecretsManager(props.dbRootSecret, 'host'),
          DB_DBNAME: ecs.Secret.fromSecretsManager(
            props.dbRootSecret,
            'dbname'
          ),
          // ユーザー名とパスワードは、別途手動作成したものを利用
          DB_USERNAME: ecs.Secret.fromSecretsManager(
            props.dbRootSecret,
            'username'
          ),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(
            props.dbRootSecret,
            'password'
          ),
        },
        environment: {
          COGNITO_USERPOOL_ID: props.userPool.userPoolId,
          COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        },
        /**
         * [AWS ECS ベストプラクティス-セキュリティ 読み取り専用のルートファイルシステムを使用する]{@link https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/bestpracticesguide/security-tasks-containers.html}
         * ICASU_NOTE: readonlyRootFilesystemを有効化すると、ECS Execやミドルウェアでのコンテナのストレージ領域への書き込みが出来なくなるので以下の記事などを参考に明示的に書き込み可能なディレクトリを作成する。
         * [Using ECS Exec with read-only root file system containers]{@link https://toris.io/2021/06/using-ecs-exec-with-readonlyrootfilesystem-enabled-containers/}
         */
        readonlyRootFilesystem: true,
      })
      .addPortMappings({
        containerPort: 80,
        hostPort: 80,
        protocol: ecs.Protocol.TCP,
      });

    // TODO: ログ出力量がコストに直結するのでFluentBitを追加設定
    //       以下は未完成コード。AWSコンテナ設計・構築本格入門をもとに構築予定
    // serviceTaskDefinition.addFirelensLogRouter("FluentBitLogRouter", {
    //   image: ecs.ContainerImage.fromRegistry("amazon/aws-for-fluent-bit:latest"),
    //   essential: true,
    //   firelensConfig: {
    //     type: ecs.FirelensLogRouterType.FLUENTBIT,
    //     options: {
    //       enableECSLogMetadata: true,
    //       configFileType: ecs.FirelensConfigFileType.FILE,
    //       configFileValue: "/fluent-bit/configs/parse-json.conf",
    //     },
    //   },
    // });

    // Cluster
    const cluster = new ecs.Cluster(this, `${id}-Cluster`, {
      vpc: props.myVpc,
      containerInsights: true,
    });

    const fargateService = new ecs.FargateService(
      this,
      `${id}-FargateService`,
      {
        cluster,
        vpcSubnets: props.myVpc.selectSubnets({ subnetGroupName: 'Protected' }),
        securityGroups: [props.ecsSecurityGroup],
        taskDefinition: serviceTaskDefinition,
        desiredCount: 1,
        maxHealthyPercent: 200,
        minHealthyPercent: 50,
        enableExecuteCommand: true,
        circuitBreaker: {
          enable: true,
          rollback: true,
        },
      }
    );

    // ALB to Fargate でSSL通信が必要な場合
    // TODO: ACMの事前登録、ドメインを確認して実施しHTTPSに変更
    // const albListener = albForApp.addListener(`${id}-AlbListener`, {
    //   port: 443,
    //   certificates: [
    //     {
    //       certificateArn: props.certificateArn,
    //     },
    //   ],
    //   // defaultAction: elbv2.ListenerAction.fixedResponse(404, {
    //   //   contentType: "text/html",
    //   //   messageBody: "Not Found",
    //   // }),
    //   sslPolicy: elbv2.SslPolicy.TLS12,
    // });
    const albListener = albForApp.addListener(`${id}-AlbListener`, {
      port: 80,
      // defaultAction: elbv2.ListenerAction.fixedResponse(404, {
      //   contentType: "text/html",
      //   messageBody: "Not Found",
      // }),
    });

    // // targetGroup
    // const fromAppTargetGroup = albListener.addTargets(`${id}-FromAppTargetGroup`, {
    //   port: 443,
    //   targets: [fargateService],
    // });
    const fromAppTargetGroup = albListener.addTargets(
      `${id}-FromAppTargetGroup`,
      {
        port: 80,
        targets: [fargateService],
        healthCheck: {
          enabled: true,
          path: '/health-check',
          healthyHttpCodes: '204',
        },
      }
    );
    fromAppTargetGroup.setAttribute(
      'deregistration_delay.timeout_seconds',
      '30'
    );
    fromAppTargetGroup.setAttribute(
      'load_balancing.algorithm.type',
      'least_outstanding_requests'
    );

    /**
     * HAK: タスク実行時に失敗する場合は、以下の記事を見てサービスの実行数を減らしてスタックの作成を止める
     * {@link https://aws.amazon.com/jp/premiumsupport/knowledge-center/cloudformation-ecs-service-stabilize/}
     */

    // Enabled WAF for ALB
    new wafv2.CfnWebACLAssociation(this, `${id}-WebAclAssociation`, {
      resourceArn: albForApp.loadBalancerArn,
      webAclArn: props.webAcl.attrArn,
    });
  }
}
