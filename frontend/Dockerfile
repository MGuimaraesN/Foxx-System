# Etapa 1: Build do React
FROM node:25-alpine AS builder

WORKDIR /app

# Definir variável de ambiente para o build (Aponta para o proxy do Nginx)
ENV VITE_API_URL=/api

COPY package*.json ./

# Instalar dependências
RUN npm ci

COPY . .

# Fazer o build do React
RUN npm run build

# Etapa 2: Servidor Nginx
FROM nginx:alpine

# Copiar os arquivos estáticos gerados (dist) para o Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração personalizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]