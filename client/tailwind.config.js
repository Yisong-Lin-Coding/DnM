module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx,html}"], // update as needed
  theme: {
    extend: {
      colors: {
        fantasy: {
          light: '#f0e6d2',
          DEFAULT: '#d4c2a1',
          dark: '#b8a07f',
        },
        action: {
          light: '#e0f7fa',
          DEFAULT: '#b2ebf2',
          dark: '#80deea',
        },
        adventure: {
          light: '#e8f5e9',
          DEFAULT: '#c8e6c9',
          dark: '#a5d6a7',
        },
        mystery: {
          light: '#f3e5f5',
          DEFAULT: '#e1bee7',
          dark: '#ce93d8',
        },
      },
      fontFamily: {
        fantasy: ['Cinzel', 'serif'],  // Example custom font
        body: ['Inter', 'sans-serif'], // Add default body font
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      spacing: {
        128: '32rem',
        144: '36rem',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
    addUtilities({
      '.scrollbar-transparent': {
        'scrollbar-width': 'thin',       // Firefox
      },
      '.scrollbar-transparent::-webkit-scrollbar': {
        width: '6px',                   // Chrome/Edge
        background: 'transparent',      // make track transparent
      },
      '.scrollbar-transparent::-webkit-scrollbar-track': {
        background: 'transparent',      // transparent track
      },
      '.scrollbar-transparent::-webkit-scrollbar-thumb': {
        background: 'rgba(255,255,255,0.2)', // semi-transparent thumb
        'border-radius': '9999px',
      },
    });
  }
  ],
}