# Run with Windows PowerShell: powershell.exe -File scripts/generate-latency-audio.ps1
# Local installed voice only; no network requests or participant audio.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$fixtureDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../evaluation/audio'))
New-Item -ItemType Directory -Path $fixtureDirectory -Force | Out-Null
$samples = @(
  @{ file = '01-name.wav'; text = 'My name is Alex.' },
  @{ file = '02-gardening.wav'; text = 'I enjoy gardening.' },
  @{ file = '03-unsure.wav'; text = 'I am not sure.' }
)
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $synthesizer.SelectVoice('Microsoft David Desktop')
  $synthesizer.Rate = 0
  $synthesizer.Volume = 100
  foreach ($sample in $samples) {
    $synthesizer.SetOutputToWaveFile((Join-Path $fixtureDirectory $sample.file))
    $synthesizer.Speak($sample.text)
    $synthesizer.SetOutputToNull()
  }
} finally { $synthesizer.Dispose() }
