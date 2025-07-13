/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        accent: '#FF0052',
        black: '#0B0518',
        white: '#f5f5f5',
        // Utility colors
        'accent-hover': '#E6004A',
        'accent-light': 'rgba(255, 0, 82, 0.1)',
        'accent-border': 'rgba(255, 0, 82, 0.3)',
        'glass-bg': 'rgba(245, 245, 245, 0.1)',
        'glass-border': 'rgba(245, 245, 245, 0.2)',
        'glass-dark': 'rgba(11, 5, 24, 0.8)',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      animation: {
        'pulse': 'pulse 2s infinite',
        'glow': 'glow 3s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        glow: {
          '0%': { boxShadow: '0 4px 12px rgba(255, 0, 82, 0.3)' },
          '100%': { boxShadow: '0 4px 20px rgba(255, 0, 82, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-3px)' },
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(11, 5, 24, 0.3)',
        'glass-inset': 'inset 0 1px 0 0 rgba(245, 245, 245, 0.1)',
        'accent': '0 4px 20px rgba(255, 0, 82, 0.3)',
        'accent-strong': '0 0 30px rgba(255, 0, 82, 0.5)',
      },
      backgroundImage: {
        'main-gradient': 'linear-gradient(135deg, #0B0518 0%, #1a0f2e 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(245, 245, 245, 0.1) 0%, rgba(245, 245, 245, 0.05) 100%)',
      }
    },
  },
  plugins: [],
} 