# ใช้ Node.js LTS v20
FROM node:20

# ตั้ง working directory ใน container
WORKDIR /app

# คัดลอกไฟล์ dependencies ก่อน เพื่อใช้ Docker cache ให้มีประสิทธิภาพ
COPY server/package*.json ./server/

# ติดตั้ง dependencies สำหรับ server
RUN cd server && npm install

# คัดลอก source code ทั้งหมดของ server
COPY server ./server

# ตั้ง ENV ให้ NODE_ENV เป็น production โดย default
ENV NODE_ENV=production

# เปิดพอร์ตสำหรับ Express API
EXPOSE 4000

# คำสั่งเริ่มรันเซิร์ฟเวอร์
CMD ["node", "server/index.js"]
