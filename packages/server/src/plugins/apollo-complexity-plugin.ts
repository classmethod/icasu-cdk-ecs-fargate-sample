import {
  type ApolloServerPlugin,
  type GraphQLRequestListener,
  HeaderMap,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
// biome-ignore lint/style/useImportType: Nestが依存関係を解決できなくなるため
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';
import { LoggerService } from 'src/utils/logger/logger.module';

const logger = new LoggerService();

export class QueryComplexityOverGraphQLError extends GraphQLError {
  constructor(message: string) {
    super(message);
    this.name = 'QueryComplexityOver';
  }
}

@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  constructor(private gqlSchemaHost: GraphQLSchemaHost) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const maxComplexity = 100;
    const { schema } = this.gqlSchemaHost;

    return {
      async responseForOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });

        if (complexity > maxComplexity) {
          logger.log('QueryComplexityOver', {
            complexity: complexity,
            operationName: request.operationName,
            query: request.query,
          });

          return {
            http: {
              status: 400,
              headers: new HeaderMap(),
            },
            body: {
              kind: 'single',
              singleResult: {
                errors: [
                  {
                    message: 'Bad Request',
                  },
                ],
              },
            },
          };
        }
        logger.log('QueryComplexity', {
          complexity: complexity,
          operationName: request.operationName,
        });

        return null;
      },
    };
  }
}
