import * as cdk from 'aws-cdk-lib';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface WafConstructProps extends cdk.StackProps {
  webAclScope: 'REGIONAL' | 'CLOUDFRONT';
  envName: string;
  projectName: string;
}

export class WafConstruct extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: WafConstructProps) {
    super(scope, id);

    /**
     * ICASU_NOTE: AWS WAFは正常な動作がブロックされていないか、DDoS攻撃や新規脆弱性の対応など継続的な運用が必要となる。顧客側で運用が難しい場合は WAF CharmなどWAF運用サービスの導入も検討すること
     *
     * ------------------------------------------------------------------------
     * WAFv2
     *
     * Statement の詳細
     * [AWS管理ルールルールグループリスト]{@link https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-list.html}
     */
    const webAcl = new wafv2.CfnWebACL(this, `${id}-WebAcl`, {
      defaultAction: { allow: {} },
      name: 'WebAcl',
      scope: props.webAclScope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'WebAcl',
        sampledRequestsEnabled: true,
      },
      // ICASU_NOTE: WAFは最初にCOUNTでルールを設定し、正常なリクエストがブロックされないか確認後にルールをBLOCKに変更する
      //       BLOCKするには overrideAction の部分を以下のように変更する
      //       overrideAction: { none: {} },
      rules: [
        {
          priority: 1,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesCommonRuleSet',
          },
          name: 'AWSManagedRulesCommonRuleSet',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        },
        {
          priority: 2,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
          },
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
        },
        {
          priority: 3,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesAmazonIpReputationList',
          },
          name: 'AWSManagedRulesAmazonIpReputationList',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
        },
        {
          priority: 4,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesLinuxRuleSet',
          },
          name: 'AWSManagedRulesLinuxRuleSet',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesLinuxRuleSet',
            },
          },
        },
        {
          priority: 5,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesPHPRuleSet',
          },
          name: 'AWSManagedRulesPHPRuleSet',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesPHPRuleSet',
            },
          },
        },
      ],
    });
    this.webAcl = webAcl;

    const wafLogGroup = new logs.LogGroup(this, `${id}-WafLogGroup`, {
      /**
       * WAFのログにはprefixが`aws-waf-logs-`になっているものしか設定できません
       * {@link  https://dev.classmethod.jp/articles/i-checked-if-there-is-a-way-to-specify-a-delivery-stream-other-than-starting-with-aws-waf-logs-in-the-aws-waf-logging-configuration/}
       */
      logGroupName: 'aws-waf-logs-test',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    new wafv2.CfnLoggingConfiguration(this, `${id}-WebAclLogging`, {
      /**
       * CfnのArnの読み取りに問題があるため、Arnを修正して取り込む
       * {@link  https://github.com/aws/aws-cdk/issues/18253#issuecomment-1022748594}
       */
      logDestinationConfigs: [
        cdk.Fn.select(0, cdk.Fn.split(':*', wafLogGroup.logGroupArn)),
      ],
      // logDestinationConfigs: [wafLogGroup.logGroupArn],
      resourceArn: webAcl.attrArn,
      /**
       * {@link  https://dev.classmethod.jp/articles/aws-waf-config-trouble-caused-by-different-versions-of-awscli/#toc-6}
       */
      loggingFilter: {
        Filters: [
          {
            Behavior: 'KEEP',
            Requirement: 'MEETS_ANY',
            /**
             * ICASU_NOTE: WAFのログの量を抑えてコスト削減するため、出力はBLOCK/COUNT/EXCLUDED_AS_COUNTに限定する。
             * COUNTとEXCLUDED_AS_COUNTの違いは以下を参照
             * [AWS WAF のログ分析に関する考慮事項]{@link https://aws.amazon.com/jp/blogs/news/aws-waf-log-analysis-considerations/}
             */
            Conditions: [
              {
                ActionCondition: {
                  Action: 'BLOCK',
                },
              },
              {
                ActionCondition: {
                  Action: 'COUNT',
                },
              },
              {
                ActionCondition: {
                  Action: 'EXCLUDED_AS_COUNT',
                },
              },
            ],
          },
        ],
        DefaultBehavior: 'DROP',
      },
    });
  }
}
