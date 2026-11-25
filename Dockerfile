FROM node:22-alpine

RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    webp \
    git \
    python3 \
    make \
    g++

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 20084

CMD ["npm", "start"]
