FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY prisma ./prisma

# 【關鍵修正】在構建階段生成 Prisma Client
# 這會確保 Prisma Client 被安裝到 node_modules 中，並對應 alpine 環境
RUN npx prisma generate

COPY src ./src

ENV NODE_ENV=production

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

EXPOSE 3001

CMD ["npm", "start"]
