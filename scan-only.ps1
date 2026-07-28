# scan-only.ps1
# Step 1 of 2. Scans the bucket and saves the full delete-list to a JSON file.
# Read-only - does not delete anything. Safe to re-run any time.

$Bucket = "jor-website-isr-cache"
$Endpoint = "https://27fdb7883570e5f6e97e985e183ea7b0.r2.cloudflarestorage.com"
$Profile = "r2"
$OutputFile = "keys-to-delete.json"

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
    Write-Host "`nABORTING: Live build ID '$LiveBuildId' was NOT found among bucket folders. Stopping - nothing scanned or saved." -ForegroundColor Red
    exit 1
}

$foldersToDelete = $allPrefixes | Where-Object { $_ -ne $LivePrefix }

Write-Host "`n=== SCANNING: enumerating objects inside $($foldersToDelete.Count) folders ===" -ForegroundColor Yellow
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

$saveData = @{
    LiveBuildId       = $LiveBuildId
    LivePrefix        = $LivePrefix
    ScannedAt         = (Get-Date).ToString("o")
    FolderCount       = $foldersToDelete.Count
    ObjectCount       = $allKeysToDelete.Count
    Keys              = $allKeysToDelete
}
$saveData | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutputFile -Encoding utf8

Write-Host "`n=== SCAN COMPLETE ===" -ForegroundColor Green
Write-Host "Folders to delete: $($foldersToDelete.Count)"
Write-Host "Total objects to delete: $($allKeysToDelete.Count)"
Write-Host "Live build kept: $LivePrefix"
Write-Host "Saved to: $OutputFile"
Write-Host "`nNext: run .\delete-only.ps1 to review this list and delete (it will NOT re-scan)." -ForegroundColor Cyan
