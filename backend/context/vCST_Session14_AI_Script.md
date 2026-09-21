# Session 14: Word Games

The runnable script is `src/services/wordGamesScript.js`. Session 14 prompt context is generated from the current script step in `promptService.js`, avoiding positional drift when one deck slide contains several questions.

Slides 1–15 use the standard welcome, saved theme song, check-in, orientation, weather, current affairs, seated exercise, and theme introduction.

## Slide 16: Common te reo Māori words

Ask the participant to click each word, listen, and try saying it aloud. Do not grade pronunciation. Whānau (family), Kaumātua (elder), Moana (ocean), Kai (food), Aroha (love), and Ka pai (good/well done) use the supplied MP3 files. Mark each word after successful playback ends. Continue stays disabled until all six are heard. Browser session storage preserves progress on refresh; the server rejects continuation without the complete clip list.

## Slides 17–31: Brain teasers

Explain Slide 17 using four GIVE and four GET words: “forgive and forget.” Invite participants to try their best and reassure them that uncertainty is welcome.

18. Wish upon a star
19. Put your foot down — offer the clue “something you say when you want to be firm”
20. Down to Earth
21. Wear your heart on your sleeve
22. Don’t count on it
23. Horsing around — accept “quit horsing around” and “don’t horse around”
24. Head over heels
25. Fall asleep
26. Big mouth
27. Over the moon
28. Way over budget
29. A score to settle — accept “settle the score”
30. Double agent
31. Killing time — accept “time to kill”

Accept a single attempt, including uncertainty, then reveal the intended saying. Each teaser has distinct correct, incorrect, and unsure acknowledgements. Recognize consecutive correct answers and strong overall performance without making comparisons to other people.

## Slide 32: What goes together?

Give “bread and butter” as the example. Ask one prompt at a time: salt and…, knife and…, cup of…, tea and…, jam and…, spoon and…, egg and…, pancake and…, kettle and…. Accept plausible everyday associations rather than one rigid answer. Offer an example if unsure.

## Slide 33: Rhymes

Explain “cat → hat, bat, mat.” Ask for one or more rhymes with sun, bee, rain, soap, and bread, one word at a time. Judge sounds rather than spelling. Respect accents and speech transcription approximations. Hide the source slide’s printed answers during the activity.

## Slide 34: Five-letter game

The interface presents a six-row, five-column board. Each letter is entered in a separate box, with physical typing, arrow keys, deletion, paste, and an on-screen QWERTY keyboard. Guesses must be recognised five-letter words; an invalid entry is explained and does not use a turn. Submitted boxes and keyboard keys show letter feedback. The hint uses its own five-box row: green in its confirmed position, yellow in a position where it does not belong, with a written explanation.

A local React practice game replaces an external embed. It needs no API, account, or third-party service. The fixed practice word is PLANT, with six guesses. Accept any five letters so dictionary restrictions do not interrupt this gentle activity. Explain green (correct position), yellow (different position), and grey (no remaining copy). Score repeated letters correctly. A hint supplies a green P at position 1 and a yellow A excluded from position 2. Include visible symbols and accessible text in addition to colour. Preserve guesses and the hint through refresh. Allow finishing at any time.

## Slides 35–37: Closing

Use the standard question wheel, saved theme song and session recap. Close with thanks and introduce Session 15: Pub Quiz.
