/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: '#080B16',
          raised: '#11162A',
          soft: '#171D34',
          line: '#29304B',
        },
        sour: {
          DEFAULT: '#8BE7FF',
          dim: '#5FC4E2',
        },
        accent: {
          DEFAULT: '#A78BFA',
          soft: '#C4B5FD',
        },
        alert: {
          DEFAULT: '#FF7A9E',
          bg: 'rgba(255,122,158,0.12)',
        },
        success: {
          DEFAULT: '#66E3B4',
          bg: 'rgba(102,227,180,0.12)',
        },
        ink: {
          DEFAULT: '#F7F8FF',
          muted: '#AAB2CE',
          faint: '#6E7899',
        },
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '14px',
      },
      boxShadow: {
        soft: '0 24px 80px rgba(0,0,0,0.34)',
        glow: '0 14px 40px rgba(139,231,255,0.16)',
      },
    },
  },
  plugins: [],
};
