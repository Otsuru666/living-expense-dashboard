/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0f172a',
          800: '#1e3a5f',
          700: '#2d4a5c',
          600: '#3d5a6c',
        },
        teal: {
          500: '#2d6a7c',
          400: '#3d7a8c',
        },
        coral: {
          500: '#e8927c',
          400: '#f4a896',
          300: '#f7baa8',
        },
        cream: '#fef7f4',
        gold: '#d4a574',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Nunito', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': {
            boxShadow: '0 12px 40px rgba(232, 146, 124, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          },
          '50%': {
            boxShadow: '0 12px 50px rgba(232, 146, 124, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%, 100%': { backgroundPosition: '100% 50%' },
          '50%': { backgroundPosition: '0% 50%' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-hover': '0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      },
    },
  },
  plugins: [],
};
