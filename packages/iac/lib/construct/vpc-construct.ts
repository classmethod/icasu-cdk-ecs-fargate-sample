import * as cdk from 'aws-cdk-lib';

import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_ssm as ssm } from 'aws-cdk-lib';
import { NatProvider, Peer } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface VpcConstructProps extends cdk.StackProps {
  vpcCidr: string;
  vpcIdSsmParamName: string;
  envName: string;
  projectName: string;
}

export class VpcConstruct extends Construct {
  public readonly myVpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    const natProvider = NatProvider.instanceV2({
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.NANO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      defaultAllowedTraffic: ec2.NatTrafficDirection.OUTBOUND_ONLY,
    });

    const myVpc = new ec2.Vpc(this, `${id}-Vpc`, {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 2,
      /**
       * ICASU_NOTE: NAT Gatewayをそのまま利用した場合、開発環境のコストが少し高い。まずはNAT Instanceを検討し冗長性が必要になったタイミングでNAT Gatewayを検討する。詳細は以下を参考。
       * [そのトラフィック、NATゲートウェイを通す必要ありますか？適切な経路で不要なデータ処理料金は削減しましょう]{@link https://dev.classmethod.jp/articles/reduce-unnecessary-costs-for-nat-gateway/#toc-12}
       *  また以下の`natGateways`の数値がNAT Gateway or NAT Instanceの個数に影響する。
       */
      natGateways: 1,
      natGatewayProvider: natProvider,
      flowLogs: {},
      subnetConfiguration: [
        /**
         * ICASU_NOTE: プライベートサブネットをどちらにするかは顧客要件に応じて変更すること
         *             PRIVATE_WITH_EGRESS: NAT Gateway/NAT Instanceなど経由でインターネットアクセスあり
         *             PRIVATE_ISOLATED: インターネットアクセスなし、VPC Endpointなどのみ
         * [AWS CDKでSubnetを作る場合のPRIVATE_WITH_EGRESSとPRIVATE_ISOLATEDを比較してみた]{@link https://dev.classmethod.jp/articles/cdk-subnet-private_with_egress-private_isolated-diff/}
         */
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Protected',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        // ,{
        //   cidrMask: 24,
        //   name: 'Private',
        //   subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        // },
      ],
    });
    natProvider.securityGroup.addIngressRule(
      Peer.ipv4(myVpc.vpcCidrBlock),
      ec2.Port.allTraffic()
    );

    const vpcFlowLogBucket = new s3.Bucket(this, `${id}-VpcFlowLogBucket`, {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    myVpc.addFlowLog(`${id}-FlowLogs`, {
      destination: ec2.FlowLogDestination.toS3(vpcFlowLogBucket),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    /**
     * ICASU_NOTE: NACL が必要かは以下の記事を参考に設定
     * [なぜネットワークACLでなくセキュリティグループで細かいトラフィック制御を行なうのか]{@link https://dev.classmethod.jp/articles/why-i-prefer-sg-to-nacl/}
     */

    // NACL for Public Subnets
    // const naclPublic = new ec2.NetworkAcl(this, `${id}-NaclPublic`, {
    //   vpc: myVpc,
    //   subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    // });

    // // Egress Rules for Public Subnets
    // naclPublic.addEntry(`${id}-NaclEgressPublic`, {
    //   direction: ec2.TrafficDirection.EGRESS,
    //   ruleNumber: 100,
    //   cidr: ec2.AclCidr.anyIpv4(),
    //   traffic: ec2.AclTraffic.allTraffic(),
    //   ruleAction: ec2.Action.ALLOW,
    // });

    // // Ingress Rules for Public Subnets
    // naclPublic.addEntry(`${id}-NaclIngressPublic`, {
    //   direction: ec2.TrafficDirection.INGRESS,
    //   ruleNumber: 100,
    //   cidr: ec2.AclCidr.anyIpv4(),
    //   traffic: ec2.AclTraffic.allTraffic(),
    //   ruleAction: ec2.Action.ALLOW,
    // });

    // --- VPC Endpoint ---

    /**
     * 最小権限での接続を簡単に実現と通信量増加時のコストメリットを考慮して
     * 各AWSリソースへのアクセスはVPC Endpointを経由する
     * コストメリットに関する参考：
     *[AWS内の通信がインターネットを経由しない今、VPC Endpointを利用する意味はあるのか？]{@link https://future-architect.github.io/articles/20210618a/}
     */

    /**
     * ICASU_NOTE: Gateway型のVPC Endpointは料金が発生しないので基本設定する。
     * [2つのVPCエンドポイントの違いを知る]{@link https://dev.classmethod.jp/articles/vpc-endpoint-gateway-type/}
     */

    // VPC Endpoint for S3
    // Fargate、ログ出力用に利用
    myVpc.addGatewayEndpoint(`${id}-S3EndpointForPrivate`, {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
    });

    // VPC Endpoint for SSM
    // SSM経由でFargateへ接続するため利用

    // myVpc.addInterfaceEndpoint(`${id}-SsmEndpointForPrivate`, {
    //   service: ec2.InterfaceVpcEndpointAwsService.SSM,
    //   subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    // });
    // myVpc.addInterfaceEndpoint(`${id}-SsmMessagesEndpointForPrivate`, {
    //   service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    //   subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    // });
    // // FargateをPrivateサブネットにし、SecretMangerから値を取得する要件がある場合
    // myVpc.addInterfaceEndpoint(`${id}-SecretsManagerEndpointForPrivate`, {
    //   service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    //   subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    // });
    // myVpc.addInterfaceEndpoint(`${id}-Ec2MessagesEndpointForPrivate`, {
    //   service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    //   subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    // });

    // VPC Endpoint for Fargate
    // myVpc.addInterfaceEndpoint(`${id}-EcrEndpointForPrivate`, {
    //   service: ec2.InterfaceVpcEndpointAwsService.ECR,
    //   subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    // });
    // myVpc.addInterfaceEndpoint(`${id}-EcrDkrEndpointForPrivate`, {
    //   service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    //   subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    // });
    // myVpc.addInterfaceEndpoint(`${id}-LogsEndpointForPrivate`, {
    //   service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    //   subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    // });

    this.myVpc = myVpc;

    // MEMO: 外部にVPCを渡す場合を考慮し、SSM Parameterに書き込む
    //       XXX部分はシステムごとに書き換える
    new ssm.StringParameter(this, `${id}-VpcIdSsmParam`, {
      description: 'This param is the VPC ID of the XXX system',
      parameterName: props.vpcIdSsmParamName,
      stringValue: myVpc.vpcId,
      tier: ssm.ParameterTier.STANDARD,
    });
  }
}
