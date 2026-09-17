#!/bin/sh
# As migracoes rodam na subida do container porque a hospedagem nao oferece um passo separado antes
# do deploy no plano gratuito. O comando e idempotente: quando nao ha migracao pendente ele nao faz
# nada. O servico sobe com exec para que o processo do Node receba os sinais do orquestrador.
set -e

npm run prisma:migrate:deploy -w backend

exec node backend/dist/server.js
