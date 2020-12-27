FROM node:latest

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y wget

COPY . /bot
RUN cd bot/ && \
    npm i

CMD ["npm", "run", "prod", "--prefix", "/bot"]
