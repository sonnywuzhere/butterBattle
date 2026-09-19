FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/

RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/data/butter.db

EXPOSE 8080
CMD ["npm", "start"]
