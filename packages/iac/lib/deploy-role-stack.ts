import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

interface Props extends cdk.StackProps {
  projectName: string;
  gitHubOwner: string;
  gitHubRepo: string;
}

export class DeployRoleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const accountId = cdk.Stack.of(this).account;
    const oidcProvider = iam.Role.fromRoleArn(
      this,
      'Role',
      `arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com`
    );

    new iam.Role(this, `${id}-AssumeRole`, {
      roleName: `${props.projectName}-assume-role`,
      assumedBy: new iam.FederatedPrincipal(
        oidcProvider.roleArn,
        {
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${props.gitHubOwner}/${props.gitHubRepo}:*`,
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AWSCloudFormationFullAccess'
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName('IAMFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
      inlinePolicies: {
        ssm: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ssm:GetParameter',
                'ssm:PutParameter',
                'ssm:StartSession',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:PutImage',
                'ecr:InitiateLayerUpload',
                'ecr:UploadLayerPart',
                'ecr:CompleteLayerUpload',
                'ecs:*',
                'ecr:DescribeRepositories',
                'ecr:DescribeImages',
                'ec2:Describe*',
                'ec2:Get*',
              ],
              resources: [`*`],
            }),
          ],
        }),
      },
    });
  }
}
