FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html/verdict-graph
RUN printf 'server {\n  listen 80;\n  location = / { return 302 /verdict-graph/; }\n  location /verdict-graph/ {\n    alias /usr/share/nginx/html/verdict-graph/;\n    try_files $uri $uri/ /verdict-graph/index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
