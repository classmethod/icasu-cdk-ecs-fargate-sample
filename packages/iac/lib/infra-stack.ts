import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { AuroraConstruct } from './construct/aurora-construct';
import { CognitoConstruct } from './construct/cognito-construct';
import { SecurityGroupConstruct } from './construct/common-sg-construct';
import { EcsConstruct } from './construct/ecs-construct';
import { VpcConstruct } from './construct/vpc-construct';
import { WafConstruct } from './construct/waf-construct';

export interface InfraStackProps extends cdk.StackProps {
  vpcCidr: string;
  vpcIdSsmParamName: string;
  repositoryName: string;
  imageTag: string;
  webAclScope: 'REGIONAL' | 'CLOUDFRONT';
  taskCpu: number;
  taskMemory: number;
  containerCpu: number;
  containerMemory: number;
  certificateArn: string;
  envName: string;
  projectName: string;
  domainPrefix: string;
  callbackUrls: string[];
  logoutUrls: string[];
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    // MEMO: 各Constructに渡すenvName/projectNameはリソースに固定名を付ける場合などに使用
    //       不要な場合は削除

    const vpc = new VpcConstruct(this, `${id}-vpc`, {
      vpcCidr: props.vpcCidr,
      vpcIdSsmParamName: props.vpcIdSsmParamName,
      envName: props.envName,
      projectName: props.projectName,
    });

    const sg = new SecurityGroupConstruct(this, `${id}-sg`, {
      myVpc: vpc.myVpc,
      envName: props.envName,
      projectName: props.projectName,
    });

    const waf = new WafConstruct(this, `${id}-waf`, {
      webAclScope: props.webAclScope,
      envName: props.envName,
      projectName: props.projectName,
    });

    // cdk.jsonなりconfigへ以降
    const databaseRootUserName = 'icasu';
    const databaseDatabaseName = 'icasudb';

    const aurora = new AuroraConstruct(this, `${id}-aurora`, {
      myVpc: vpc.myVpc,
      envName: props.envName,
      projectName: props.projectName,
      allowInboundSecurityGroups: [sg.securityGroupForFargate],
      database: {
        databaseRootUserName: databaseRootUserName,
        defaultDatabaseName: databaseDatabaseName,
      },
    });

    const cognito = new CognitoConstruct(this, `${id}-cognito`, {
      domainPrefix: props.domainPrefix,
      callbackUrls: props.callbackUrls,
      logoutUrls: props.logoutUrls,
      addClientForE2ETest: props.envName === 'dev',
      envName: props.envName,
      projectName: props.projectName,
    });

    const ecs = new EcsConstruct(this, `${id}-ecs`, {
      myVpc: vpc.myVpc,
      webAcl: waf.webAcl,
      taskCpu: props.taskCpu,
      taskMemory: props.taskMemory,
      containerCpu: props.containerCpu,
      containerMemory: props.containerMemory,
      repositoryName: props.repositoryName,
      ecsSecurityGroup: sg.securityGroupForFargate,
      albSecurityGroup: sg.securityGroupForAlb,
      imageTag: props.imageTag,
      dbRootSecret: aurora.dbRootSecret,
      // TODO: HTTPS対応
      certificateArn: 'TBD',
      userPool: cognito.userPool,
      userPoolClient: cognito.userPoolClient,
      envName: props.envName,
      projectName: props.projectName,
    });

    new cdk.CfnOutput(this, 'MYSQL_ENDPOINT', {
      value: aurora.cluster.clusterEndpoint.hostname,
    });
    new cdk.CfnOutput(this, 'BASTION_EC2_INSTANCE_ID', {
      value: aurora.bationHostEc2.instanceId,
    });
    new cdk.CfnOutput(this, 'USER_POOL_ID', {
      value: cognito.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'CLIENT_ID', {
      value: cognito.userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'LOAD_BALANCER_DNS_NAME', {
      value: ecs.loadBalancerDnsName,
    });
  }
}
