FROM node:latest

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y wget

COPY ./ telegram-support-bot
RUN cd telegram-support-bot/ && \
    npm i

CMD ["node", "/telegram-support-bot/src/support.js"]
