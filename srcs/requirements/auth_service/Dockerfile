FROM node:slim

WORKDIR /app

COPY /conf/package.json ./

COPY scripts/ ./

COPY . .

RUN npm install bcryptjs

# # a supprimer une fois projet termine !!
# RUN apt-get update && apt-get install -y sqlite3

CMD ["node", "scripts/server.js"]

EXPOSE 3001