# Samples host CPU and memory, plus the backend's node and Rhubarb processes, into a CSV while a load test runs.
# Run it in a second terminal on the machine hosting the backend, stop it with Ctrl+C, and keep the CSV with the run's results.
#   powershell -File scripts/sample-host-load.ps1 -OutFile evaluation/results/RUN/host-load.csv
param(
  [Parameter(Mandatory = $true)][string]$OutFile,
  [int]$IntervalSeconds = 2
)

$cores = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$totalMemMb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB)
"timestamp,elapsedSeconds,cpuPercent,memUsedMb,memTotalMb,backendCpuPercent,backendMemMb,rhubarbProcesses,rhubarbCpuPercent" | Out-File -FilePath $OutFile -Encoding utf8

# Per-process CPU is the change in processor time between samples, divided by the measured gap and all logical cores.
# The queries themselves take a second or more, so the gap is measured rather than assumed to be IntervalSeconds.
$previous = @{}
$last = $null
while ($true) {
  $now = Get-Date
  $elapsed = if ($last) { ($now - $last).TotalSeconds } else { 0 }
  $last = $now
  $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  $os = Get-CimInstance Win32_OperatingSystem
  $memUsedMb = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1KB)
  $backend = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*src/server.js*' -or $_.CommandLine -like '*src\server.js*' }
  $rhubarb = @(Get-Process -Name rhubarb -ErrorAction SilentlyContinue)
  $current = @{}
  $deltaFor = {
    param($process)
    $current[$process.Id] = $process.TotalProcessorTime.TotalSeconds
    if ($previous.ContainsKey($process.Id)) { $current[$process.Id] - $previous[$process.Id] } else { 0 }
  }
  $backendCpu = 0; $backendMem = 0
  foreach ($b in $backend) {
    $p = Get-Process -Id $b.ProcessId -ErrorAction SilentlyContinue
    if ($p) { $backendCpu += & $deltaFor $p; $backendMem += $p.WorkingSet64 / 1MB }
  }
  $rhubarbCpu = 0
  foreach ($r in $rhubarb) { $rhubarbCpu += & $deltaFor $r }
  $previous = $current
  $scale = if ($elapsed -gt 0) { 100 / ($elapsed * $cores) } else { 0 }
  $fields = @($now.ToUniversalTime().ToString('o'), [math]::Round($elapsed, 2), $cpu, $memUsedMb, $totalMemMb, [math]::Round($backendCpu * $scale, 1),
    [math]::Round($backendMem), $rhubarb.Count, [math]::Round($rhubarbCpu * $scale, 1))
  ($fields | ForEach-Object { [string]::Format([cultureinfo]::InvariantCulture, '{0}', $_) }) -join ',' |
    Out-File -FilePath $OutFile -Append -Encoding utf8
  Start-Sleep -Seconds $IntervalSeconds
}
