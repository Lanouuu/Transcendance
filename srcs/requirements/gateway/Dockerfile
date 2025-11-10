FROM node:18-alpine AS builder

WORKDIR /app

COPY ./www ./www

COPY ./conf/package*.json ./www/
COPY ./conf/tsconfig.json ./www/
COPY ./conf/tailwind.config.js ./www/

RUN cd www && npm install
RUN cd www && npx tsc

# Installation, initialisation et compilation du css avec tailwind
RUN cd www && npx tailwindcss -i ./css/style.css -o ./css/output.css --minify

# Vérification que output.css a bien été créé
RUN test -f /app/www/css/output.css || (echo "ERROR: output.css not generated!" && exit 1)

#-------------------------

FROM nginx:stable-alpine

#supprimer bash une fois le projet termine !!!
RUN apk add --no-cache bash openssl

# A SUPPRIMER | Seulement pour le dev
RUN apk add --no-cache npm
RUN npm install -g typescript tailwindcss
#####################################

RUN rm /etc/nginx/conf.d/default.conf
COPY ./conf/nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/www/ /etc/nginx/html/

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

# CMD de base a decommenter
# CMD ["nginx", "-g", "daemon off;"]

# A SUPPRIMER ##################################################
# Copie du script de demarage pour le hot reload
COPY conf/start_debug.sh /etc/nginx/html/conf/start_debug.sh
RUN chmod +x /etc/nginx/html/conf/start_debug.sh
# CMD pour la prod 
CMD ["/etc/nginx/html/conf/start_debug.sh"]
# A SUPPRIMER ##################################################
