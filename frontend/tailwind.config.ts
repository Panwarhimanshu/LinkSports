import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4fb', 100: '#d6e4f5', 200: '#adc8ea', 300: '#7aa5d9', 400: '#4a82c7',
          500: '#1f62b8', 600: '#004fab', 700: '#00428f', 800: '#003674', 900: '#002a5b', 950: '#001b3b',
        },
        brand: {
          DEFAULT: '#004fab', // LinkSports logo blue
          light: '#1f62b8',
          dark: '#00428f',
        },
        // Palette is deliberately small: LinkSports blue (built around the logo colour),
        // one accent (orange), neutral grays, and red only for errors/destructive actions.
        blue: {
          50: '#eef4fb',
          100: '#d6e4f5',
          200: '#adc8ea',
          300: '#7aa5d9',
          400: '#4a82c7',
          500: '#1f62b8',
          600: '#004fab',
          700: '#00428f',
          800: '#003674',
          900: '#002a5b',
          950: '#001b3b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Impact', 'Arial Narrow', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': "url('/hero-pattern.svg')",
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};

export default config;
