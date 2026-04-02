# Stage 1: Build the React Application
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

# Copy all frontend files to build
COPY . .
RUN npm run build

# Stage 2: Serve the Built Application with Nginx
FROM nginx:alpine

# Copy the custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the static dist folder into the Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
