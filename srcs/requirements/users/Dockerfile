FROM node:22

WORKDIR /app

COPY ./conf/package*.json ./

COPY --chown=node:node ./scripts/ ./scripts/

RUN mkdir ./data/

RUN apt-get update && apt-get install -y sqlite3

RUN npm install 

# a supprimer une fois projet termine !!

CMD ["node", "./scripts/main.js"]