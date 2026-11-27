FROM node:22-alpine AS builder

WORKDIR /app
COPY web/control-plane/package.json web/control-plane/package-lock.json* ./
RUN npm ci
COPY web/control-plane/ .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
