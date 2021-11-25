FROM node:16-alpine3.11

RUN apk update && \
    apk add wget python3 build-base

COPY . /bot
RUN cd bot/ && \
    npm i

CMD ["npm", "run", "prod", "--prefix", "/bot"]
