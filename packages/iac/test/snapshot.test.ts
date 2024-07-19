process.env.CDK_DEFAULT_ACCOUNT = '123456789012';
process.env.CDK_DEFAULT_REGION = 'ap-northeast-1';

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { getAppParameters } from '../bin/parameter';
// MEMO: cdk.jsonをテストする場合
// import * as cdk_json from '../cdk.json';
// const appParameter = cdk_json['context'][envName];
import { InfraStack } from '../lib/infra-stack';

test('dev snapshot test', () => {
  const app = new cdk.App();
  const envKey = 'dev';
  const appParameter = getAppParameters(envKey);

  const stack = new InfraStack(app, 'MyTestStack', {
    vpcCidr: appParameter.vpcCidr,
    vpcIdSsmParamName: appParameter.vpcIdSsmParamName,
    repositoryName: appParameter.repositoryName,
    imageTag: appParameter.imageTag,
    webAclScope: 'REGIONAL',
    taskCpu: Number(appParameter.taskCpu),
    taskMemory: Number(appParameter.taskMemory),
    containerCpu: Number(appParameter.containerCpu),
    containerMemory: Number(appParameter.containerMemory),
    certificateArn: 'TBD',
    envName: appParameter.envName,
    projectName: appParameter.projectName,
    domainPrefix: appParameter.domainPrefix,
    callbackUrls: appParameter.callbackUrls,
    logoutUrls: appParameter.logoutUrls,
    env: appParameter.env,
  });

  const template = Template.fromStack(stack);
  expect(template).toMatchSnapshot();
});
