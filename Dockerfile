FROM node:16-alpine
WORKDIR /bot

COPY ./src /bot/src
COPY ./package.json /bot/package.json
COPY ./package-lock.json /bot/package-lock.json

RUN apk update
RUN apk add wget python3 build-base
RUN npm install

CMD ["npm", "run", "prod", "--prefix", "/bot"]
