export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./App.tsx"
  ],
  theme: {
    extend: {
      colors: {
        background: '#020617', // Slate 950
        surface: '#0f172a', // Slate 900
        primary: '#6366f1', // Indigo 500
        secondary: '#64748b', // Slate 500
        accent: '#8b5cf6', // Violet 500
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
