import { join } from 'node:path';
import { GraphQLDefinitionsFactory } from '@nestjs/graphql';

const definitionsFactory = new GraphQLDefinitionsFactory();

definitionsFactory.generate({
  typePaths: [`${join(process.cwd(), '../../schema.graphql')}`],
  path: join(process.cwd(), 'src/graphql.ts'),
  outputAs: 'class',
  watch: false,
});
