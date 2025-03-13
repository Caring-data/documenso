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
# Ejecutar turbo prune para reducir el tamaño de la imagen
RUN turbo prune --scope=@documenso/web --docker

###########################
#   INSTALLER CONTAINER   #
###########################
FROM base AS installer
WORKDIR /app
# Encryption keys
ARG NEXT_PRIVATE_ENCRYPTION_KEY="CAFEBABE"
ENV NEXT_PRIVATE_ENCRYPTION_KEY="$NEXT_PRIVATE_ENCRYPTION_KEY"
ARG NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="DEADBEEF"
ENV NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="$NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY"
# Copiar los archivos generados por turbo prune
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
COPY --from=builder /app/lingui.config.ts ./lingui.config.ts
# Instalar dependencias
RUN npm ci
# Instalar el generador de Prisma que falta
RUN npm install -g prisma-json-types-generator
# Copiar el resto del código fuente
COPY --from=builder /app/out/full/ .
# Copiar el archivo turbo.json
COPY turbo.json turbo.json
# Instalar Turbo de forma global (fixed)
RUN npm install -g "turbo@^1.9.3"
# Construir la aplicación
RUN turbo run build --filter=@documenso/web...

###########################
#     RUNNER CONTAINER    #
###########################
FROM base AS runner
WORKDIR /app
# Definir usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
# Copiar node_modules desde la etapa installer
COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules
# Instalar el generador de Prisma en el runner también
RUN npm install -g prisma-json-types-generator
# Cambiar permisos de los directorios necesarios
RUN chown -R nextjs:nodejs /app
USER nextjs
# Copiar solo lo necesario para el frontend
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json
# Copiar Prisma solo si lo necesitas en producción
COPY --from=installer --chown=nextjs:nodejs /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma
COPY --from=installer --chown=nextjs:nodejs /app/packages/prisma/migrations ./packages/prisma/migrations
# Copiar Prisma Client generado
COPY --from=installer --chown=nextjs:nodejs /app/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=installer --chown=nextjs:nodejs /app/node_modules/@prisma/ ./node_modules/@prisma/
# Copiar el package.json y turbo.json del raíz
COPY --from=installer --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=installer --chown=nextjs:nodejs /app/turbo.json ./turbo.json
# Configurar la variable de entorno para producción
ENV NODE_ENV=production
# Exponer el puerto en el que se ejecutará Next.js
EXPOSE 3002
# Comando para ejecutar la aplicación
CMD ["npx", "turbo", "run", "start", "--filter=@documenso/web"]
