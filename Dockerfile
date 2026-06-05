FROM node:22-bookworm-slim
WORKDIR /usr/src

RUN apt-get update && apt-get install -y ca-certificates

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ARG APP_COMMIT_ID
ENV APP_COMMIT_ID="${APP_COMMIT_ID}"

ENTRYPOINT if [ -f /var/run/secrets/kpc/environment ]; then . /var/run/secrets/kpc/environment; fi && npm run start
