FROM node:22-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY web ./web
COPY scripts ./scripts
COPY .env.example ./.env.example
ENV HOST=0.0.0.0 PORT=8787 CLIPIA_DATA_DIR=/data
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/etat || exit 1
CMD ["node","server/index.js"]
