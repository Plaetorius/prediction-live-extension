/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        twitch: {
          purple: '#9147ff',
          'purple-dark': '#7c3aed',
          'purple-darker': '#6b21a8',
        },
        prediction: {
          success: '#00C851',
          'success-hover': '#00A843',
          error: '#FF0052',
          'error-hover': '#D10042',
        }
      },
      animation: {
        'pulse': 'pulse 2s infinite',
        'glow': 'glow 3s ease-in-out infinite alternate',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        glow: {
          '0%': { boxShadow: '0 4px 12px rgba(255, 0, 82, 0.3)' },
          '100%': { boxShadow: '0 4px 20px rgba(255, 0, 82, 0.6)' },
        }
      }
    },
  },
  plugins: [],
} 