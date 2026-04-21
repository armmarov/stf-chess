/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        // Desktop nav appears at 900px+; below that the burger menu is used.
        nav: '900px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}

