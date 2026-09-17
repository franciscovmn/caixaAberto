FROM node:24-alpine AS build

WORKDIR /app

# O postinstall do backend roda "prisma generate" durante o npm ci. O schema, o prisma.config.ts e
# uma DATABASE_URL precisam existir antes dele, e nao depois: sem isso o npm ci morre com "Could not
# find Prisma Schema". A URL e de fachada e nenhuma conexao e aberta com ela, porque o generate so le
# o schema. Este ENV vale apenas para o estagio de build e nao alcanca a imagem final.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

# O tsconfig.base.json fica na raiz e o backend/tsconfig.json o estende. Sem ele, tanto o prisma
# generate quanto o tsc falham com "File '../tsconfig.base.json' not found".
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json ./backend/package.json
COPY backend/prisma.config.ts ./backend/prisma.config.ts
COPY backend/prisma ./backend/prisma
COPY frontend/package.json ./frontend/package.json
RUN npm ci

# Gerado de novo depois do codigo inteiro entrar, para o client nunca ficar defasado em relacao ao
# schema que acabou de ser copiado.
COPY backend ./backend
RUN npm run prisma:generate -w backend
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
