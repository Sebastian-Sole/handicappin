const headers = [
  "Does anyone really even know how handicap's work?",
  "So... what's the deal with handicap's anyways?",
  "Um... I think I know how handicap's work?",
  "Ugh, handicap's are too confusing to understand...",
  "Man, #$@! this handicap stuff...",
  "I can't be bothered to learn how handicap's work...",
  "God, I hate handicap's...",
  "Understanding handicap's will surely improve mine... right?",
];

export const getRandomHeader = () => {
  return headers[Math.floor(Math.random() * headers.length)];
};
