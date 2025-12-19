FROM node:slim

WORKDIR /app

RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

COPY /conf/package.json ./

RUN npm install

COPY scripts/ ./scripts/

COPY . .

CMD ["node", "scripts/server.js"]

EXPOSE 3004