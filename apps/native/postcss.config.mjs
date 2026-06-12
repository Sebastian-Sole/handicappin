// Expo's metro CSS pipeline only runs Tailwind when a PostCSS config with
// @tailwindcss/postcss exists — without this file the raw @theme/@utility
// at-rules in the generated global.css reach react-native-css's lightningcss
// compiler and native bundling fails ("Unknown at rule: @utility").
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
