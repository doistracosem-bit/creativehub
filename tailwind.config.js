/** @type {import('tailwindcss').Config} */
// Identidade Dois Traços — azul-marinho #0b3974 + azul-gelo #e8f1fd
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#eef4fc',          // fundo da página (derivado do azul-gelo)
        surface: '#ffffff',         // cartões
        'surface-hover': '#f4f8fe',
        'border-subtle': '#dbe6f4',
        'accent-primary': '#0b3974', // azul-marinho da marca
        'accent-hover': '#082c5a',
        'accent-glow': '#006096',    // azul do símbolo do logo
        'text-main': '#0a1f3d',
        'text-muted': '#5d6f88',
        gelo: '#e8f1fd',
        marinho: '#0b3974',
        celeste: '#8ec5ef',          // azul claro do mascote
      },
      borderRadius: {
        'bento': '24px',
        'card': '24px',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // "mono" agora usa a mesma fonte (sem cara de terminal), com números alinhados
        mono: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        logo: ['Quicksand', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        suave: '0 1px 2px rgba(11,57,116,.04), 0 8px 24px -12px rgba(11,57,116,.18)',
        elevada: '0 24px 60px -20px rgba(11,57,116,.35)',
      },
    },
  },
  plugins: [],
}
