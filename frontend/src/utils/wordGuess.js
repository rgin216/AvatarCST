// Offline Wordle-style guess dictionary. The activity deliberately uses common,
// recognisable words so a rejected entry can be explained without a network call.
const DICTIONARY = new Set(`about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alien alike alive allow alone along alter among anger angle angry apart apple apply arena argue arise armed armor arrow asset audio audit avoid award aware awful bacon badge basic beach began begin being below bench berry birth black blame blank blast blend bless blind block blood board brain brave bread break bring broad brown brush build bunch burst cabin cable carry catch cause chain chair chalk chase cheap check chest chief child chose claim class clean clear clerk click climb clock close cloud coach coast coral count court cover craft crash crazy cream crime cross crowd crown cycle dance dealt death debut delay depth diary dirty doubt dozen draft drama dream dress drink drive earth eight elbow empty enemy enjoy entry equal error event every exact faith false fancy fault feast fence fewer field fifth fifty fight final first flame flash fleet floor flour focus force forth forty found frame frank fresh front fruit funny giant given glass globe glory grace grade grain grand grant grape graph grass great green greet grief group grown guard guess guest guide habit happy heart heavy hello hence hobby honey horse hotel house human humor ideal image imply index inner input issue ivory jelly jewel judge juice knife known label labor large later laugh layer learn lease least leave legal lemon level light limit linen links liver local logic loose lover lucky lunch magic major maker mango march marry match maybe mayor medal media merit metal might minor model money month moral motor mount mouse mouth movie music never night noise north novel nurse ocean offer often order other ought paint panel party peace peach pearl phase phone photo piano piece pilot pitch place plain plane plant plate plenty point pound power press price prime print prize proof proud prove public quick quiet radio raise range rapid ratio reach ready realm reason rebel reply right river roast robot rough round route royal rural scale scare scene score sense serve setup seven shade shake shame shape share sharp sheep sheet shelf shell shift shine shirt shock shoot short shout sight since skill sleep slice slide slope small smart smile smoke snack snake solar solid solve sorry sound south space spare speak speed spend spent spice spine split sport spray squad staff stage stake stand start state steam steel stick still stock stone stool store storm story strain straw strip study style sugar suite sunny super sweet swing table taste teach team thank their theme there these thick thing think third those three throw tiger tight timer tired title today topic total touch tower trace track trade train treat trend trial tribe trick tried truck truly trust truth twice under union unite until upper upset urban usual valid value video visit voice waste watch water wheel while white whole whose woman world worry worse worth would write wrong year young youth`.split(/\s+/));

export function isValidWord(word) {
  return DICTIONARY.has(String(word || '').trim().toLowerCase());
}

// Exact matches consume copies first, so repeated letters never earn extra yellows.
export function scoreGuess(guess, solution) {
  const letters = solution.toUpperCase().split('');
  const entered = guess.toUpperCase().split('');
  const result = entered.map((letter, index) => {
    if (letter === letters[index]) { letters[index] = null; return 'green'; }
    return 'grey';
  });
  entered.forEach((letter, index) => {
    if (result[index] === 'green') return;
    const found = letters.indexOf(letter);
    if (found >= 0) { result[index] = 'yellow'; letters[found] = null; }
  });
  return result;
}

export function wordHint(solution) {
  return { green: { letter: solution[0], position: 1 }, yellow: { letter: solution[2], excludedPosition: 2 } };
}
