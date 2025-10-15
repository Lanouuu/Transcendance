FROM node:slim

RUN mkdir -p /app/public/assets

#WORKDIR /app/public/assets

#COPY assets/* .

WORKDIR /app

COPY ./conf/package*.json ./

COPY --chown=node:node ./scripts/ ./scripts/

RUN npm install

#COPY index.html ./public

#COPY style.css ./public

#COPY script.js ./public

#COPY spriteClass.js ./public

CMD ["node", "./scripts/server.js"]

EXPOSE 3002