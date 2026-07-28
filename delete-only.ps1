# delete-only.ps1
# Step 2 of 2. Reads keys-to-delete.json (from scan-only.ps1) and deletes those objects
# in batches of 1000. Does NOT re-scan the bucket - fast to re-run if the prompt is missed.
# Re-verifies the live build ID has not changed since the scan before doing anything.

$Bucket = "jor-website-isr-cache"
$Endpoint = "https://27fdb7883570e5f6e97e985e183ea7b0.r2.cloudflarestorage.com"
$Profile = "r2"
$BatchSize = 1000
$InputFile = "keys-to-delete.json"

if (-not (Test-Path $InputFile)) {
    Write-Host "ABORTING: $InputFile not found. Run .\scan-only.ps1 first." -ForegroundColor Red
    exit 1
}

$saved = Get-Content $InputFile -Raw | ConvertFrom-Json
Write-Host "Loaded saved scan from: $($saved.ScannedAt)" -ForegroundColor Cyan
Write-Host "Saved live build ID: $($saved.LiveBuildId)"
Write-Host "Folders: $($saved.FolderCount) | Objects: $($saved.ObjectCount)"

Write-Host "`nRe-checking the CURRENT live build ID from joronline.com (to make sure nothing deployed since the scan)..." -ForegroundColor Cyan
$bytes = (Invoke-WebRequest -Uri "https://joronline.com/BUILD_ID" -UseBasicParsing).Content
$CurrentLiveBuildId = -join ($bytes -split "`n" | Where-Object { $_ -ne "" } | ForEach-Object { [char][int]$_ })
$CurrentLiveBuildId = $CurrentLiveBuildId.Trim()
Write-Host "Current live build ID: $CurrentLiveBuildId" -ForegroundColor Green

if ($CurrentLiveBuildId -ne $saved.LiveBuildId) {
    Write-Host "`nABORTING: A new deploy happened since the scan (saved: $($saved.LiveBuildId), current: $CurrentLiveBuildId)." -ForegroundColor Red
    Write-Host "Re-run .\scan-only.ps1 to get a fresh, accurate list before deleting anything." -ForegroundColor Red
    exit 1
}

$allKeysToDelete = $saved.Keys

Write-Host "`n=== SUMMARY (from saved scan) ===" -ForegroundColor Yellow
Write-Host "Folders to delete: $($saved.FolderCount)"
Write-Host "Total objects to delete: $($allKeysToDelete.Count)"
Write-Host "Folder being KEPT (current live build): $($saved.LivePrefix)" -ForegroundColor Green

$confirm = Read-Host "`nType exactly DELETE to permanently delete all $($allKeysToDelete.Count) objects above (anything else cancels)"
if ($confirm -ne "DELETE") {
    Write-Host "Cancelled. Nothing was deleted." -ForegroundColor Yellow
    exit 0
}

$logFile = "r2-cleanup-log-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
Write-Host "`nDeleting in batches of $BatchSize... logging to $logFile" -ForegroundColor Cyan

$tempDir = Join-Path $env:TEMP "r2-cleanup-batches"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$batchNum = 0
$deletedCount = 0
for ($i = 0; $i -lt $allKeysToDelete.Count; $i += $BatchSize) {
    $batchNum++
    $endIndex = [Math]::Min($i + $BatchSize - 1, $allKeysToDelete.Count - 1)
    $batchKeys = $allKeysToDelete[$i..$endIndex]

    $deletePayload = @{
        Objects = @($batchKeys | ForEach-Object { @{ Key = $_ } })
        Quiet   = $true
    } | ConvertTo-Json -Depth 5

    $batchFile = Join-Path $tempDir "batch-$batchNum.json"
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($batchFile, $deletePayload, $utf8NoBom)

    Write-Host "Batch $batchNum : deleting $($batchKeys.Count) objects..."
    $result = aws s3api delete-objects --bucket $Bucket --delete "file://$batchFile" --endpoint-url $Endpoint --profile $Profile --no-cli-pager 2>&1
    $result | Out-File -FilePath $logFile -Append

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Batch $batchNum reported an error - check $logFile" -ForegroundColor Red
    } else {
        $deletedCount += $batchKeys.Count
    }
}

Remove-Item -Recurse -Force $tempDir

Write-Host "`nDone. Attempted deletion of $($allKeysToDelete.Count) objects across $batchNum batches." -ForegroundColor Green
Write-Host "Full log saved to $logFile"
Write-Host "Recommended: re-run .\scan-only.ps1 afterward to confirm only the live build folder remains." -ForegroundColor Cyan
