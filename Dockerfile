# Multi-stage build that bundles backend + built frontend for Railway/containers

# ---- Stage 1: install dependencies and build frontend ----
FROM node:20-bullseye AS builder
WORKDIR /app

# Install backend deps
COPY package*.json ./
RUN npm install --omit=dev

# Install frontend deps separately (keeps cache scoped)
COPY frontend-vue/package*.json frontend-vue/
RUN cd frontend-vue && npm install

# Copy the rest of the source
COPY . .

# Build SPA (output ends up in frontend-vue/dist)
RUN cd frontend-vue && npm run build

# ---- Stage 2: production image ----
FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy backend runtime files + node_modules + built SPA
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend-vue/dist ./frontend-vue/dist

EXPOSE 5050

CMD ["node", "backend/server.js"]
