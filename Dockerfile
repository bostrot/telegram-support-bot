FROM node:16-alpine3.11
WORKDIR /bot

COPY . /bot

RUN apk update
RUN apk add wget python3 build-base
RUN rm -rf node_modules
RUN npm install

CMD ["npm", "run", "prod", "--prefix", "/bot"]
