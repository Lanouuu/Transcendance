FROM node:22

WORKDIR /app

COPY ./conf/package*.json ./

COPY --chown=node:node ./conf/index.js ./

RUN npm install

CMD ["node", "index.js"]