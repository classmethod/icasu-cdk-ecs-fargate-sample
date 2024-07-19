FROM node:20-alpine3.17 AS build

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-lock.yaml /app
COPY pnpm-workspace.yaml /app
COPY packages/server/package.json /app/packages/server/
RUN pnpm install \
  --frozen-lockfile \
  --filter server
COPY schema.graphql /app
COPY packages/server/tsconfig.build.json /app/packages/server/
COPY packages/server/tsconfig.json /app/packages/server/
COPY packages/server/.env /app/packages/server/
COPY packages/server/src /app/packages/server/src
COPY packages/server/schema.prisma /app/packages/server/

RUN cd /app/packages/server &&\
  pnpm nest build
RUN cd /app/packages/server &&\
  pnpm prisma generate
RUN yes | pnpm install \
  --frozen-lockfile \
  --filter server \
  --prod
RUN cd /app/packages/server &&\
  pnpm prisma generate

FROM node:20-alpine3.17

ENV GRAPHQL_SCHEMA_PATH "./schema.graphql"
ENV PORT=80

WORKDIR /app

COPY --from=build /app/schema.graphql /app/
COPY --from=build /app/packages/server/.env /app/
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/server/node_modules /app/packages/server/node_modules
COPY --from=build /app/packages/server/dist /app/packages/server/dist
COPY --from=build /app/packages/server/package.json /app/packages/server/

EXPOSE 80
ENTRYPOINT [ "node" ]
CMD [ "packages/server/dist/main.js" ]
