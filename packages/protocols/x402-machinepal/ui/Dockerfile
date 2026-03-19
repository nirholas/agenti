# CHANGE: Use 'node:18' instead of 'node:18-alpine' for the build stage
FROM node:18 AS build

WORKDIR /app
COPY package*.json ./

# This is much more likely to succeed now
RUN npm install

COPY . .
RUN npm run build

# Stage 2 can stay Alpine because it just runs Nginx (no building involved)
FROM nginx:alpine

# Install openssl for certificate generation
RUN apk add --no-cache openssl

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]