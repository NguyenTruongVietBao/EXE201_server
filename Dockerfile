# Sử dụng Node.js phiên bản LTS làm base image
FROM node:18-alpine

# Tạo thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và package-lock.json
COPY package*.json ./

# Cài đặt dependencies
RUN npm ci --only=production

# Sao chép toàn bộ source code
COPY . .

# Tạo user non-root để chạy ứng dụng an toàn hơn
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Chuyển quyền sở hữu thư mục cho user nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port (Render sẽ tự động detect port từ environment variable)
EXPOSE 3000

# Command để chạy ứng dụng trong production
CMD ["node", "index.js"] 