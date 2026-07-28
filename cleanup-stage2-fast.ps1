# cleanup-stage2-fast.ps1
# Deletes every ISR cache folder in R2 except the current live build ID.
# Uses batch DeleteObjects (up to 1000 keys per call) instead of one-by-one deletes.
# Dry-run preview + explicit single confirmation required before any deletion.

$Bucket = "jor-website-isr-cache"
$Endpoint = "https://27fdb7883570e5f6e97e985e183ea7b0.r2.cloudflarestorage.com"
$Profile = "r2"
$BatchSize = 1000

Write-Host "Re-checking the current live build ID from joronline.com..." -ForegroundColor Cyan
$bytes = (Invoke-WebRequest -Uri "https://joronline.com/BUILD_ID" -UseBasicParsing).Content
$LiveBuildId = -join ($bytes -split "`n" | Where-Object { $_ -ne "" } | ForEach-Object { [char][int]$_ })
$LiveBuildId = $LiveBuildId.Trim()
Write-Host "Live build ID: $LiveBuildId" -ForegroundColor Green
$LivePrefix = "incremental-cache/$LiveBuildId/"

Write-Host "`nFetching current top-level folder list from bucket (fresh)..." -ForegroundColor Cyan
$raw = aws s3api list-objects-v2 --bucket $Bucket --prefix "incremental-cache/" --delimiter "/" --endpoint-url $Endpoint --profile $Profile --no-cli-pager | ConvertFrom-Json
$allPrefixes = $raw.CommonPrefixes | ForEach-Object { $_.Prefix }

if ($allPrefixes -notcontains $LivePrefix) {
    Write-Host "`nABORTING: Live build ID '$LiveBuildId' was NOT found among bucket folders. Stopping without deleting anything." -ForegroundColor Red
    exit 1
}

$foldersToDelete = $allPrefixes | Where-Object { $_ -ne $LivePrefix }

Write-Host "`n=== DRY RUN: enumerating objects inside $($foldersToDelete.Count) folders to be deleted ===" -ForegroundColor Yellow
$allKeysToDelete = @()
foreach ($folder in $foldersToDelete) {
    $continuationToken = $null
    do {
        if ($continuationToken) {
            $listRaw = aws s3api list-objects-v2 --bucket $Bucket --prefix "$folder" --endpoint-url $Endpoint --profile $Profile --starting-token $continuationToken --no-cli-pager | ConvertFrom-Json
        } else {
            $listRaw = aws s3api list-objects-v2 --bucket $Bucket --prefix "$folder" --endpoint-url $Endpoint --profile $Profile --no-cli-pager | ConvertFrom-Json
        }
        if ($listRaw.Contents) {
            $allKeysToDelete += $listRaw.Contents | ForEach-Object { $_.Key }
        }
        $continuationToken = $listRaw.NextContinuationToken
    } while ($continuationToken)
    Write-Host "  Scanned $folder - running total: $($allKeysToDelete.Count) objects"
}

Write-Host "`n=== SUMMARY ===" -ForegroundColor Yellow
Write-Host "Folders to delete: $($foldersToDelete.Count)"
Write-Host "Total objects to delete: $($allKeysToDelete.Count)"
Write-Host "Folder being KEPT (current live build): $LivePrefix" -ForegroundColor Green

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
    $deletePayload | Out-File -FilePath $batchFile -Encoding utf8

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
Write-Host "Recommended: re-run the Stage 1 list command afterward to confirm only '$LiveBuildId' remains." -ForegroundColor Cyan
