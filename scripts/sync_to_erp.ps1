
$source = "c:\Users\ze9167867\Desktop\erp_bamlo-frica"
$destination = "c:\Users\ze9167867\Desktop\erp"

# exclusions
$exclude = @(".git", "node_modules", ".next", ".env", ".vscode")

Get-ChildItem -Path $source -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Substring($source.Length)
    $destPath = $destination + $relativePath
    
    # Check if path contains excluded items
    $skip = $false
    foreach ($ex in $exclude) {
        if ($relativePath -match "\\$ex") { $skip = $true; break }
        if ($relativePath -eq "\$ex") { $skip = $true; break }
    }
    
    if (-not $skip) {
        if ($_.PSIsContainer) {
            if (-not (Test-Path $destPath)) {
                New-Item -ItemType Directory -Path $destPath -Force | Out-Null
            }
        } else {
            Copy-Item -Path $_.FullName -Destination $destPath -Force
        }
    }
}

Write-Host "Sync Complete"
