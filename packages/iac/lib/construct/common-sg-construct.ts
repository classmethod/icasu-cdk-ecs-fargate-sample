import type * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SecurityGroupConstructProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  envName: string;
  projectName: string;
}

export class SecurityGroupConstruct extends Construct {
  public readonly securityGroupForFargate: ec2.SecurityGroup;
  public readonly securityGroupForAlb: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    props: SecurityGroupConstructProps
  ) {
    super(scope, id);

    // --- Security Groups ---
    const securityGroupForAlb = new ec2.SecurityGroup(this, `${id}-SgAlb`, {
      vpc: props.myVpc,
      allowAllOutbound: false,
    });

    securityGroupForAlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    // MEMO: 証明書作成後は以下に変更
    // securityGroupForAlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
    securityGroupForAlb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());
    this.securityGroupForFargate = new ec2.SecurityGroup(
      this,
      `${id}-SgFargate`,
      {
        vpc: props.myVpc,
        allowAllOutbound: false,
      }
    );
    this.securityGroupForFargate.addIngressRule(
      securityGroupForAlb,
      ec2.Port.tcp(80)
    );
    this.securityGroupForFargate.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTcp()
    );
  }
}
