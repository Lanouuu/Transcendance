FROM node:22

WORKDIR /app

COPY ./conf/package*.json ./

COPY --chown=node:node ./scripts/ ./scripts/

RUN mkdir ./data/

RUN mkdir -p ./data/avatars && chown -R node:node ./data/avatars
COPY ./assets/default.png ./data/avatars/default.png

# a supprimer une fois projet termine !!
RUN apt-get update && apt-get install -y sqlite3

RUN npm install 

CMD ["node", "./scripts/main.js"]