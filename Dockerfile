FROM node:latest

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y wget && \
    apt-get install -y git
RUN git clone https://github.com/bostrot/telegram-support-bot && \
    cd telegram-support-bot/ && \
    npm i

COPY config.js /telegram-support-bot/config.js

CMD ["node", "/telegram-support-bot/src/support.js"]
