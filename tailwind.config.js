/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sidebar palette
        sb: {
          bg:     '#1a1d2e',
          hover:  '#252840',
          active: '#2e3150',
          border: '#252840',
          text:   '#8b90b8',
          muted:  '#575c80',
          white:  '#ffffff',
        },
        // Canvas (main area)
        cv: {
          bg:     '#f5f6fa',
          white:  '#ffffff',
          border: '#e5e7f0',
          hover:  '#eeeef5',
        },
        // Brand
        brand: {
          500: '#5b52e3',
          600: '#4f46e5',
          700: '#3d36c0',
        },
        // Status
        dot: {
          online:  '#2eb67d',
          busy:    '#e01e5a',
          away:    '#ecb22e',
          offline: '#9ca3af',
        },
      },
      keyframes: {
        slideUp:   { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideInRight: { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        bounce3:   {
          '0%,80%,100%': { transform: 'translateY(0)' },
          '40%':          { transform: 'translateY(-5px)' },
        },
      },
      animation: {
        'slide-up': 'slideUp 0.18s ease-out',
        'fade-in':  'fadeIn 0.15s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-1': 'bounce3 1.2s 0.0s ease-in-out infinite',
        'bounce-2': 'bounce3 1.2s 0.2s ease-in-out infinite',
        'bounce-3': 'bounce3 1.2s 0.4s ease-in-out infinite',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'pop':  '0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
        'ring': '0 0 0 3px rgba(79,70,229,0.18)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
