FROM node:16-alpine3.11

RUN apk update && \
    apk add wget python build-base

COPY . /bot
RUN cd bot/ && \
    npm i && \
    npm rebuild

CMD ["npm", "run", "prod", "--prefix", "/bot"]
