###########################
#         BASE            #
###########################
FROM node:18-alpine AS base

# Instalar herramientas esenciales
RUN apk add --no-cache libc6-compat jq make cmake g++ openssl

WORKDIR /app

###########################
#         BUILDER         #
###########################
FROM base AS builder

# Instalar Turbo Repo de forma global
RUN npm install -g "turbo@^1.9.3"

# Copiar el resto del código fuente
COPY . .

# Instalar dependencias antes del build
RUN npm ci

# Construir frontend y backend
RUN turbo run build --filter=@documenso/web...
RUN turbo run build --filter=@documenso/openpage-api...

###########################
#     RUNNER CONTAINER    #
###########################
FROM base AS runner

WORKDIR /app

COPY package.json package-lock.json ./

# Agregar Turbo al PATH
ENV PATH="/app/node_modules/.bin:$PATH"

# Definir usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

# Copiar solo lo necesario para el frontend
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/node_modules ./node_modules

# Copiar Prisma solo si lo necesitas en producción
COPY --from=builder /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma
COPY --from=builder /app/packages/prisma/migrations ./packages/prisma/migrations

# Copiar Prisma Client generado
COPY --from=builder /app/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=builder /app/node_modules/@prisma/ ./node_modules/@prisma/


# Configurar la variable de entorno para producción
ENV NODE_ENV=production

# Exponer el puerto en el que se ejecutará Next.js
EXPOSE 3002

# Comando para ejecutar la aplicación
CMD ["npm", "run", "start"]