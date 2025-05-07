/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-bg': '#000000',
        'secondary-bg': '#1f1f1f',
        'tertiary-bg': '#7cbeff',
        'primary-text': '#ffffff',
        'secondary-text': '#808080',
        'accent-blue': '#2f93ff',
        'accent-gray': '#6c757d'
      },
      fontFamily: {
        roboto: ['Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'welcome': "url('@/assets/backgrounds/background.jpg')"
      },
    },
  },
  plugins: [],
};