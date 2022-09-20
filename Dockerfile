FROM node:18.4-alpine
WORKDIR /bot

COPY ./src /bot/src
COPY ./package.json /bot/package.json
COPY ./package-lock.json /bot/package-lock.json
COPY ./tsconfig.json /bot/tsconfig.json

RUN apk update
RUN apk add wget python3 build-base
RUN npm install

CMD ["npm", "run", "prod", "--prefix", "/bot"]
