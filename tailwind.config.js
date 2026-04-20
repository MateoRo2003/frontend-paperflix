/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // PaperFlix brand colors (dark purple theme)
        brand: {
          bg:        '#1a0a3c',
          sidebar:   '#160833',
          card:      '#241155',
          hover:     '#2d1469',
          accent:    '#F5C518',
          purple:    '#7c3aed',
          text:      '#e2d9f3',
          muted:     '#9181b4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
