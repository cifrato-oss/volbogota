# Imagen para Cloud Run.
#
# Existe en paralelo a App Hosting, que sigue construyendo este mismo repo con su
# propio adaptador y sin enterarse de este archivo. La diferencia que justifica
# tenerlo: acá el build es nuestro, así que el caché de dependencias y el de Next
# se pueden reutilizar entre despliegues — que es exactamente lo que App Hosting
# no expone y lo que hace que su rollout tarde cinco minutos cada vez.
#
# Tres etapas para que la imagen final no cargue con lo que solo hizo falta para
# compilar. `output: "standalone"` deja un server.js con las dependencias que de
# verdad usa; copiar `node_modules` entero multiplicaría el tamaño por varias
# veces y con él el tiempo de arranque en frío.

# --- deps: solo instalar, para que esta capa se reutilice mientras el lockfile no cambie
FROM node:22-slim AS deps
WORKDIR /app

# corepack pide confirmación antes de descargar pnpm; en un build no interactivo
# eso falla en vez de preguntar.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- builder: compilar
FROM node:22-slim AS builder
WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next incrusta las `NEXT_PUBLIC_*` en el bundle del navegador al compilar, así que
# tienen que llegar como build args: puestas en runtime no harían nada. Es la misma
# restricción que en App Hosting, por otro mecanismo.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_DONAR_SELECCION
# Solo staging la enciende: deja ver los bancos sembrados por `seed:sangre`.
ARG NEXT_PUBLIC_MOSTRAR_MOCK

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_DONAR_SELECCION=$NEXT_PUBLIC_DONAR_SELECCION \
    NEXT_PUBLIC_MOSTRAR_MOCK=$NEXT_PUBLIC_MOSTRAR_MOCK \
    BUILD_STANDALONE=true

# `next build` exporta NEXT_PHASE=phase-production-build, y `env.ts` lo usa para no
# exigir los secretos de producción durante la compilación. Una máquina de build
# legítimamente no los tiene; se validan cuando el servidor arranca de verdad.
RUN pnpm run build

# --- runner: lo mínimo para servir
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Cloud Run inyecta PORT y espera que el proceso escuche ahí. El valor por defecto
# es solo para correr esta imagen a mano.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Sin root: si algo logra ejecutar código en el contenedor, que no sea como root.
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
