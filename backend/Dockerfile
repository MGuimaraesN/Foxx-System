# Etapa 1: Build
FROM node:25-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci

# Copiar o resto do código fonte
COPY . .

# Fazer o build do TypeScript e gerar cliente Prisma
RUN npx prisma generate
RUN npm run build

# Etapa 2: Runner (Imagem final mais leve)
FROM node:25-alpine

WORKDIR /app

# Instalar openssl para o Prisma funcionar no Alpine
RUN apk -U add --no-cache openssl

COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar arquivos construídos da etapa anterior
COPY --from=builder /app/dist ./dist
COPY  /prisma ./prisma
COPY prisma.config.ts ./
COPY .env ./

# Gerar cliente Prisma e aplicar migrações
RUN npx prisma generate

# Expor a porta definida no .env ou padrão
EXPOSE 3020

# Script de inicialização para rodar migrações e depois o servidor
CMD ["sh", "-c", "npx prisma migrate deploy &&node dist/server.js"]