FROM node:slim

WORKDIR /app

COPY /conf/package.json ./

RUN npm install

COPY scripts/ ./scripts/

COPY . .

CMD ["node", "scripts/server.js"]

EXPOSE 3004