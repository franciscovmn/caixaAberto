FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci

COPY backend ./backend
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run prisma:generate -w backend
RUN npm run build -w backend

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# As dependencias de desenvolvimento ficam na imagem de proposito. O CLI do Prisma e o tsx que le o
# prisma.config.ts estao entre elas, e sao o que aplica as migracoes na subida do container. Podar
# aqui deixaria a imagem menor e o deploy sem como migrar o banco.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/docker-entrypoint.sh ./backend/docker-entrypoint.sh

EXPOSE 3000

CMD ["sh", "backend/docker-entrypoint.sh"]
