###########################
#   BASE CONTAINER       #
###########################
FROM node:18-alpine AS base

# Instalar herramientas esenciales
RUN apk add --no-cache libc6-compat jq make cmake g++ openssl

# Crear directorio de trabajo
WORKDIR /app

##########################
#   BUILDER STAGE        #
##########################
FROM base AS builder

# Copiar archivos de dependencias y hacer instalación
COPY package.json package-lock.json ./
RUN npm ci

# Instalar Turbo Repo de forma global
RUN npm install -g turbo

# Copiar el código fuente y construir
COPY . .
RUN npm run build

###########################
#   RUNNER STAGE         #
##########################
FROM base AS runner

# Crear un usuario sin privilegios correctamente en Alpine Linux
RUN addgroup -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# Establecer la carpeta de trabajo
WORKDIR /app

# Copiar archivos necesarios desde el builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/ ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/public ./apps/web/public

# Configurar el usuario sin privilegios
USER nextjs

# Configurar la variable de entorno para producción
ENV NODE_ENV=production

# Comando de inicio
CMD ["npx", "turbo", "run", "start", "--filter=@documenso/web"]
