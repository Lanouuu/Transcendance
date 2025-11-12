FROM node:slim

WORKDIR /app

COPY /conf/package.json ./

COPY scripts/ ./scripts/

COPY . .

RUN npm install bcryptjs
RUN npm install otplib qrcode

CMD ["node", "scripts/server.js"]

EXPOSE 3001