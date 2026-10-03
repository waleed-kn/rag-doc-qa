# syntax=docker/dockerfile:1

# ---- 1. install dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc* ./
RUN npm ci

# ---- 2. build the app ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Fake values so the build can run. Real values are passed when the container starts.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV GEMINI_API_KEY=placeholder
ENV GROQ_API_KEY=placeholder
RUN npm run build

# ---- 3. small runtime image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a normal user, not root
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]