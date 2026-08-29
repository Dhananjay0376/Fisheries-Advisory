/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme specific colors
        darkice: '#B6E6E9',
        darkturquoise: '#4EC6D4',
        darkpeach: '#F2D9B7',
        darktealsoft: '#71C7BD',
        darktealdeep: '#1E6E6F',

        // Light theme specific colors
        lightamber: '#F3B900',
        lightred: '#E45B11',
        lightemerald: '#FA7301',

        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          550: '#0ea5e9', // Sky blue
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        }
      }
    },
  },
  plugins: [],
}
