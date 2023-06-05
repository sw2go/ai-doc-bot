FROM node:18-alpine AS dependencies

#add package needed to build Next.js
RUN apk add --no-cache libc6-compat

WORKDIR /app
COPY package.json package-lock.json ./
RUN  npm install --production

FROM node:18-alpine AS builder

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# disabling telemetry speeds up the build a bit
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 chatbot

COPY --from=builder --chown=chatbot:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER chatbot

EXPOSE 3000

ENV PORT 3000

# At container start up, run the system-shell
# when missing, create required folders (reason: home is mounted as volume)
# then execute the application (keeping the same process)
ENTRYPOINT ["/bin/sh", "-c", "mkdir -p ~/ctx && mkdir -p ~/log && exec npm start"]















