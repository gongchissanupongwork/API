/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}", // Scan ไฟล์ที่ใช้ Tailwind class
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1e40af", // สีหลักที่ใช้ในปุ่ม หรือ heading
        secondary: "#9333ea",
        danger: "#dc2626",
        success: "#16a34a",
      },
    },
  },
  plugins: [],
};
