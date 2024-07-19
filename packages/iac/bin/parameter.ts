import type { Environment } from 'aws-cdk-lib';

const ENV_NAMES = ['dev', 'stg', 'prd'] as const;
type EnvName = (typeof ENV_NAMES)[number];

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

export interface AppParameter {
  projectName: string;
  github: {
    owner: string;
    repo: string;
  };
  envName: EnvName;
  env: Environment; // デプロイ先の AWS アカウント ID および AWS リージョン
  vpcCidr: string;
  vpcIdSsmParamName: string;
  imageTag: string;
  repositoryName: string;
  certificateArn: string;
  taskCpu: number;
  taskMemory: number;
  containerCpu: number;
  containerMemory: number;
  domainPrefix: string;
  callbackUrls: string[];
  logoutUrls: string[];
}

const commonParameters = {
  projectName: 'icasu-ecs-fargate',
  github: {
    owner: 'classmethod-internal',
    repo: 'icasu-cdk-ecs-fargate-sample',
  },
};

const appParameters: { [key in EnvName]: AppParameter } = {
  dev: {
    ...commonParameters,
    envName: 'dev',
    env: {
      account: account,
      region: region,
    },
    vpcCidr: '10.100.0.0/16',
    vpcIdSsmParamName: '/XXX/VpcId',
    imageTag: 'DUMMY',
    repositoryName: 'icasu-ecs-fargate-sample-app',
    certificateArn: 'TBD',
    taskCpu: 256,
    taskMemory: 512,
    containerCpu: 256,
    containerMemory: 512,
    domainPrefix: 'icasu-ecs-fargate-sample-app',
    callbackUrls: ['https://classmethod.jp/'],
    logoutUrls: ['https://classmethod.jp/'],
  },
  stg: {
    ...commonParameters,
    envName: 'stg',
    env: {
      account: account,
      region: region,
    },
    vpcCidr: '10.100.0.0/16',
    vpcIdSsmParamName: '/XXX/VpcId',
    imageTag: 'DUMMY',
    repositoryName: 'icasu-ecs-fargate-sample-app',
    certificateArn: 'TBD',
    taskCpu: 256,
    taskMemory: 512,
    containerCpu: 256,
    containerMemory: 512,
    domainPrefix: 'stg-cx-sample',
    callbackUrls: ['https://classmethod.jp/'],
    logoutUrls: ['https://classmethod.jp/'],
  },
  prd: {
    ...commonParameters,
    envName: 'prd',
    env: {
      account: account,
      region: region,
    },
    vpcCidr: '10.100.0.0/16',
    vpcIdSsmParamName: '/XXX/VpcId',
    imageTag: 'DUMMY',
    repositoryName: 'icasu-ecs-fargate-sample-app',
    certificateArn: 'TBD',
    taskCpu: 256,
    taskMemory: 512,
    containerCpu: 256,
    containerMemory: 512,
    domainPrefix: 'cx-sample',
    callbackUrls: ['https://classmethod.jp/'],
    logoutUrls: ['https://classmethod.jp/'],
  },
};

export const getAppParameters = (envKey: string): AppParameter => {
  if (!isEnv(envKey)) {
    throw new Error(`Not found environment key: ${envKey}`);
  }

  const params = appParameters[envKey];
  if (params.env.account == null || params.env.region == null) {
    throw new Error(
      `Environment variables not found. Please ensure that CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION are set in your environment.`
    );
  }

  return params;
};

const isEnv = (value: string): value is EnvName => {
  return (ENV_NAMES as readonly string[]).includes(value);
};
