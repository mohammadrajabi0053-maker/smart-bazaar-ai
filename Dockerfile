FROM node:26-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# به‌روزرسانی بسته‌های سیستم‌عامل پایه پیش از کاهش دسترسی
RUN echo "os-refresh 2026-11-18" && apk upgrade --no-cache

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p data public/uploads \
  && chown -R node:node /app

USER node
EXPOSE 3000

CMD ["node", "server.js"]
