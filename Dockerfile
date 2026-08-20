FROM node:20-alpine

RUN apk add --no-cache \
  tzdata \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/

ENV NODE_ENV=production
RUN npm install --omit=dev && \
    cd backend && npm install --omit=dev

COPY . .

EXPOSE 3111

CMD ["node", "backend/src/server.js"]
