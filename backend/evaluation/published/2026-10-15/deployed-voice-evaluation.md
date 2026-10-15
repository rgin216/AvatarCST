# Deployed voice/avatar latency evaluation

## Deployed voice/avatar pipeline pilot

This separate experiment exercised https://deleted-primarily-finals-figured.trycloudflare.com/api using the deployed OpenAI transcription/text/speech pipeline, uploaded synthetic Windows speech fixtures and Rhubarb avatars. Planned measured trials: 18; excluded session-start turns: 6. Complete: true. Stop reason: none.

Avatar | Measured attempts | Succeeded | Failed | Mean seconds | Median seconds | p95 seconds
--- | --- | --- | --- | --- | --- | ---
female | 9 | 9 | 0 | 4.032 | 5.040 | 7.182
male | 9 | 9 | 0 | 3.082 | 2.628 | 5.673

### Cache-sensitive repetitions

Avatar | Repetition | Successful n | Mean seconds | Median seconds
--- | --- | --- | --- | ---
female | 1 | 3 | 4.952 | 6.533
female | 2 | 3 | 3.721 | 5.040
female | 3 | 3 | 3.422 | 4.464
male | 1 | 3 | 3.094 | 2.628
male | 2 | 3 | 3.413 | 4.354
male | 3 | 3 | 2.737 | 2.453

### female server stages

Stage | Recorded n | Mean seconds | Median seconds
--- | --- | --- | ---
sttMs | 9 | 0.852 | 0.628
orchestratorMs | 9 | 1.008 | 1.028
audioMs | 9 | 2.073 | 2.983
ttsMs | 6 | 1.611 | 1.563
rhubarbMs | 6 | 1.498 | 1.442
totalMs | 9 | 3.935 | 4.939

### male server stages

Stage | Recorded n | Mean seconds | Median seconds
--- | --- | --- | ---
sttMs | 9 | 0.718 | 0.600
orchestratorMs | 9 | 0.870 | 0.883
audioMs | 9 | 1.359 | 0.000
ttsMs | 4 | 1.510 | 1.304
rhubarbMs | 4 | 1.548 | 1.560
totalMs | 9 | 2.950 | 2.538

Successful trials required nonempty audio retrieval and Rhubarb mouth cues for every returned speech segment. Requests advanced each fresh session using a fixed three-fixture sequence; they were not identical-prompt repetitions. Requests used a two-second gap without waiting for browser narration. Synthetic English Windows speech does not represent natural accents, background noise or microphone recordings. Cache and prefetch effects were retained. TTS/Rhubarb service times can overlap and must not be summed as wall time. Missing timing fields on cached paths are excluded from stage averages, not replaced with zero.

These are upload-to-API-completion timings, not browser time to first audible speech or first visible lip movement. Browser playback onset, microphone capture/finalisation, acoustic onset and avatar rendering are unmeasured. Only three repetitions per configuration were planned; treat percentiles and configuration comparisons as descriptive pilot statistics. Deployed build revision was not independently verified.


Evidence: deployed-summary.json, deployed-voice-rows.jsonl and deployed-voice-samples.csv in this directory. This pilot measures latency and audio/lip-sync delivery, not therapeutic effectiveness.
