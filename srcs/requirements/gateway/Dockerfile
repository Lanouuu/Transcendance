FROM nginx:stable-alpine

RUN apk add --no-cache openssl

RUN rm /etc/nginx/conf.d/default.conf
COPY ./conf/nginx.conf /etc/nginx/nginx.conf

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

EXPOSE 8080
EXPOSE 443