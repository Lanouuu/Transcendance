FROM node:slim

RUN mkdir -p /app/public/assets

RUN mkdir -p /app/public/scripts

WORKDIR /app/public/assets

COPY assets/* ./

WORKDIR /app/public

COPY ./conf/package*.json ./

COPY --chown=node:node ./scripts/ ./scripts/

RUN npm install


EXPOSE 3002

CMD ["node", "./scripts/server.js"]
