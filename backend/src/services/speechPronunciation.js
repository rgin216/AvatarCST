// Spoken forms are deliberately separate from transcripts and slide text.
// Add overrides only after a pronunciation has been checked with the user.
// User's spoken guide: ma–co(mb)–ro(w); separate syllables to avoid “makuru”.
export const prepareSpeechText = (text) => text.replace(/\bMakaurau\b/gi, 'Mah-koh-roh');
