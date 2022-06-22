FROM node:16-alpine
WORKDIR /bot

COPY . /bot

RUN apk update
RUN apk add wget python3 build-base
RUN npm install

CMD ["npm", "run", "prod", "--prefix", "/bot"]
