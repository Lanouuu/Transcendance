FROM node:18-alpine AS builder

WORKDIR /app

COPY ./conf/package*.json ./www/
COPY ./conf/tsconfig.json ./www/
RUN cd www && npm install

COPY ./www ./www

RUN cd www && npx tsc

#-------------------------

FROM nginx:stable-alpine

RUN apk add --no-cache bash openssl

RUN rm /etc/nginx/conf.d/default.conf
COPY ./conf/nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/www/ /etc/nginx/html/

# Génération du SSL
RUN mkdir -p /etc/nginx/ssl
ARG DOMAIN_NAME
ARG ADMIN_NAME

ENV DOMAIN_NAME=$DOMAIN_NAME
ENV ADMIN_NAME=$ADMIN_NAME

RUN openssl req -x509 -nodes -days 365 \
    -subj "/C=FR/ST=IDF/L=Paris/O=42/OU=42/CN=${DOMAIN_NAME}/UID=${ADMIN_NAME}" \
    -addext "subjectAltName=DNS:${DOMAIN_NAME}" \
    -newkey rsa:2048 -keyout /etc/nginx/ssl/transcendence.key \
    -out /etc/nginx/ssl/transcendence.crt

EXPOSE 8080 443

CMD ["nginx", "-g", "daemon off;"]
