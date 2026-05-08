FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --include=dev --workspace @lms/shared --workspace @lms/web

FROM deps AS build
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @lms/shared && npm run build --workspace @lms/web

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @lms/shared --workspace @lms/web
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/public apps/web/public
COPY --from=build /app/apps/web/next.config.mjs apps/web/next.config.mjs
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@lms/web"]
