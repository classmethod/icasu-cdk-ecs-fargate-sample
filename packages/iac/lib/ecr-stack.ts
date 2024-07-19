import * as cdk from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
// import { aws_events_targets as events_targets } from "aws-cdk-lib";

export interface EcrConstructProps extends cdk.StackProps {
  repositoryName: string;
  envName: string;
  projectName: string;
}

export class EcrStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcrConstructProps) {
    super(scope, id);

    // --- ECR ---

    // Create a repository
    const repository = new ecr.Repository(this, props.repositoryName, {
      repositoryName: `${props.repositoryName}`,
      /**
       * {@link  https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/image-scanning-basic.html}
       */
      imageScanOnPush: true,
      /**
       * Amazon ECR で不変タグを使用する
       * {@link https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/bestpracticesguide/security-tasks-containers.html}
       */
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
    });
    /** ICASU_NOTE: InspectorV2などでリポジトリをセキュリティスキャンする場合、イメージを更新しても脆弱性のあるイメージが残ると検出され続けるので古いイメージが消えるよう設定する。
     * サイドカーがある場合は、サイドカーのイメージタグも考慮すること
     * [ECRでECSで使用中のイメージを消したくないけどライフサイクルでは難しい?]{@link https://zenn.dev/fujiwara/scraps/05cf6f0ea80d22}
     */
    repository.addLifecycleRule({ maxImageCount: 5 });

    // ベーシックスキャンを通知する場合設定
    // const target = new events_targets.SnsTopic(props.alarmTopic);
    // repository.onImageScanCompleted("ImageScanComplete").addTarget(target);
  }
}
