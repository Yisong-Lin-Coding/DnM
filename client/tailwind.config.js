module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx,html}"], // update as needed
  theme: {
    extend: {
      colors: {
      website: {
          default: {
            50:  "#eaeaf0",
            100: "#c5c6d1",
            200: "#9fa0b3",
            300: "#797a95",
            400: "#535477",
            500: "#1A1A2E", // main brand
            600: "#161628",
            700: "#121221",
            800: "#0d0d19",
            900: "#090912",
          },
          highlights: {
            50:  "#e6ecf3",
            100: "#c0cedd",
            200: "#99aec6",
            300: "#728eaf",
            400: "#4b6d98",
            500: "#0F3460", // highlight
            600: "#0c2a4e",
            700: "#0a213d",
            800: "#07172b",
            900: "#050e1a",
          },
          specials: {
            50:  "#fde8ec",
            100: "#f9c1cb",
            200: "#f59aa9",
            300: "#f17387",
            400: "#ed4c66",
            500: "#E94560", // accent
            600: "#c63a50",
            700: "#a32f41",
            800: "#7f2432",
            900: "#5c1923",
          },
          neutral: {
            50:  "#F9F9F9",
            100: "#f2f2f2",
            200: "#e5e5e5",
            300: "#d9d9d9",
            400: "#bfbfbf",
            500: "#a6a6a6",
            600: "#8c8c8c",
            700: "#737373",
            800: "#595959",
            900: "#404040",
          }
        },
  fantasy: {
    name: "📜 Fantasy Theme",
    description: "Ancient parchment with magical gold and mystical accents",
    default: {
      50: '#fefcf3', 100: '#fef9e7', 200: '#fdf2d1', 300: '#fbe6a2', 400: '#f7d072',
      500: '#f4e5d3', 600: '#e8d5b7', 700: '#d4c4a0', 800: '#b8a082', 900: '#8b7355', 950: '#4a3728'
    },
    highlights: {
      50: '#fffbeb', 100: '#fef3c7', 200: '#fed478', 300: '#fdc43f', 400: '#fbbf24',
      500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03'
    },
    specials: {
      50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc',
      500: '#a855f7', 600: '#9333ea', 700: '#7c3aed', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764'
    }
  },
  forest: {
    name: "🌲 Forest Theme",
    description: "Deep woodland greens with earthy browns and nature accents",
    default: {
      50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
      500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16'
    },
    highlights: {
      50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15',
      500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12', 950: '#422006'
    },
    specials: {
      50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6',
      500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724'
    }
  },
  city: {
    name: "🏙️ City Theme",
    description: "Urban steel grays with neon blue highlights and warning orange",
    default: {
      50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
      500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712'
    },
    highlights: {
      50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee',
      500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344'
    },
    specials: {
      50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c',
      500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407'
    }
  },
  mountain: {
    name: "⛰️ Mountain Theme",
    description: "Rocky stone grays with icy blue peaks and warm sunset highlights",
    default: {
      50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e',
      500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917', 950: '#0c0a09'
    },
    highlights: {
      50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
      500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49'
    },
    specials: {
      50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171',
      500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a'
    }
  },
  plains: {
    name: "🌾 Plains Theme",
    description: "Golden grasslands with warm earth tones and sky blue accents",
    default: {
      50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
      500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03'
    },
    highlights: {
      50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
      500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49'
    },
    specials: {
      50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15',
      500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12', 950: '#422006'
    }
  },
  hills: {
    
    default: {
      50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
      500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16'
    },
    highlights: {
      50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9',
      500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e'
    },
    specials: {
      50: '#fef7f0', 100: '#feecdc', 200: '#fed4b9', 300: '#fdba8c', 400: '#ff8a4c',
      500: '#ff5a1f', 600: '#ea3e0f', 700: '#c4260f', 800: '#9c2015', 900: '#7c1d16', 950: '#431109'
    }
  }
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
        'scrollbar-color': 'transparent transparent',
      },
      '.scrollbar-transparent:hover': {
        'scrollbar-color': 'rgba(148,163,184,0.55) transparent',
      },
      '.scrollbar-transparent::-webkit-scrollbar': {
        width: '6px',                   // Chrome/Edge
        background: 'transparent',      // make track transparent
      },
      '.scrollbar-transparent::-webkit-scrollbar-track': {
        background: 'transparent',      // transparent track
      },
      '.scrollbar-transparent::-webkit-scrollbar-thumb': {
        background: 'transparent',
        'border-radius': '9999px',
      },
      '.scrollbar-transparent:hover::-webkit-scrollbar-thumb': {
        background: 'rgba(148,163,184,0.55)',
        'border-radius': '9999px',
      },
    });
  }
  ],
}
