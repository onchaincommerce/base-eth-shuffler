import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        crypto: {
          primary: '#6E00FF',
          secondary: '#00FFFF',
          accent: '#FF5EFF',
          dark: '#070B14',
          'dark-800': '#0F1625',
          'dark-600': '#161E30',
          neon: '#64FFDA',
          cosmic: '#2D0076',
          nebula: '#FF0099',
          stardust: '#3D85C6',
          void: '#000C25',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'crypto-grid': 'linear-gradient(to right, rgba(30, 32, 50, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(30, 32, 50, 0.3) 1px, transparent 1px)',
        'cosmic-nebula': 'radial-gradient(ellipse at top right, rgba(110, 0, 255, 0.15), transparent 70%), radial-gradient(ellipse at bottom left, rgba(255, 94, 255, 0.15), transparent 70%)',
        'stellar-dust': 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm48 25a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-43-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm63 5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM34 38a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm56 29a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 86a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8-62a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm52 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-4-4a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-38 52a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm54-3a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-9-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-43-34a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm36-20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-10 45a3 3 0 1 0 0-6 3 3 0 0 0 0 6z\' fill=\'%236E00FF\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
      },
      animation: {
        'glow': 'glow 4s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 7s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(110, 0, 255, 0.7)' },
          '33%': { boxShadow: '0 0 25px rgba(0, 255, 255, 0.7)' },
          '66%': { boxShadow: '0 0 30px rgba(255, 94, 255, 0.7)' },
          '100%': { boxShadow: '0 0 20px rgba(100, 255, 218, 0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'cosmic': '0 0 30px rgba(110, 0, 255, 0.3)',
        'nebula': '0 0 20px rgba(0, 255, 255, 0.3), 0 0 40px rgba(255, 94, 255, 0.2)',
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      {
        cryptotheme: {
          "primary": "#6E00FF",
          "secondary": "#00FFFF",
          "accent": "#FF5EFF",
          "neutral": "#070B14",
          "base-100": "#0F1625",
          "info": "#64FFDA",
          "success": "#64FFDA",
          "warning": "#FFD100",
          "error": "#FF3D81",
        },
      },
    ],
  },
};
export default config;
