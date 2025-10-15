FROM node:slim

WORKDIR /app

COPY /conf/package.json ./

COPY scripts/ ./scripts/

COPY . .

RUN npm install bcryptjs
RUN npm install otplib qrcode

# # a supprimer une fois projet termine !!
# RUN apt-get update && apt-get install -y sqlite3

CMD ["node", "scripts/server.js"]

EXPOSE 3001