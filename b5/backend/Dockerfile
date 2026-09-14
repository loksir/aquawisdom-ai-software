FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache sqlite
COPY package*.json ./
RUN npm install --legacy-peer-deps --only=production
COPY . .
RUN mkdir -p /data
EXPOSE 5015
ENV NODE_ENV=production
ENV DOCKER_ENV=true
ENV PORT=5015
ENV HOST=0.0.0.0
CMD ["npm", "start"]
