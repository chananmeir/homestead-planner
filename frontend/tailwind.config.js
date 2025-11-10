/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'garden-green': '#4ade80',
        'soil-brown': '#92400e',
        'frost-blue': '#dbeafe',
      }
    },
  },
  plugins: [],
}
