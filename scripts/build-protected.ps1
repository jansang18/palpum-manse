[CmdletBinding()]
param(
    [string]$AppRoot = '',
    [string]$OutputDir = '',
    [string]$SigningPropertiesPath = '',
    [switch]$PreflightOnly,
    [switch]$VerifyOnly,
    [string]$ApkPath = '',
    [string]$AabPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedSignerSha256 = 'da1950eab27b62b7c0ac92a21b34a2fab32ff582f0e68be0d6e72d56488508aa'
$ArtifactBaseName = [System.Text.Encoding]::UTF8.GetString(
    [System.Convert]::FromBase64String('7Leo66qF7ISg66eM7IS466ClX+yVoO2UjOumrOuUlOyekOyduF/rs7TtmLg=')
)
$ReleaseWebFiles = @(
    'index.html',
    'luxury.css',
    'apple.css',
    'nav.js',
    'share.js',
    'polish.css',
    'main-logo.png',
    'cosmos.jpg',
    'styles/legend-tokens.css',
    'styles/legend-layout.css',
    'styles/legend-motion.css',
    'assets/legend-landscape.webp',
    'assets/legend-seal.webp',
    'scripts/vendor/manseryeok.browser.js',
    'scripts/manseryeok-adapter.js',
    'scripts/legend-era.js',
    'scripts/legend-resonance.js',
    'scripts/legend-copy.js',
    'scripts/legend-view.js',
    'scripts/legend-nav.js'
)
$WebOnlyFiles = @(
    'sw.js',
    'manifest.webmanifest',
    'icon-192.png',
    'icon-512.png',
    'apple-touch-icon.png'
)
$ProtectedFiles = @(
    'index.html',
    'nav.js',
    'share.js',
    'scripts/vendor/manseryeok.browser.js',
    'scripts/manseryeok-adapter.js',
    'scripts/legend-era.js',
    'scripts/legend-resonance.js',
    'scripts/legend-copy.js',
    'scripts/legend-view.js',
    'scripts/legend-nav.js'
)

function Resolve-AbsolutePath {
    param([string]$BasePath, [string]$Candidate)
    if ([System.IO.Path]::IsPathRooted($Candidate)) {
        return [System.IO.Path]::GetFullPath($Candidate)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Candidate))
}

function Invoke-Checked {
    param(
        [string]$Label,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [switch]$Quiet
    )
    Write-Host "[release] $Label"
    $rawOutput = @()
    $exitCode = -1
    $previousErrorActionPreference = $ErrorActionPreference
    Push-Location -LiteralPath $WorkingDirectory
    try {
        $ErrorActionPreference = 'Continue'
        $rawOutput = & $FilePath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
    }
    $lines = @($rawOutput | ForEach-Object { $_.ToString() })
    if (-not $Quiet) { $lines | ForEach-Object { Write-Host $_ } }
    if ($exitCode -ne 0) {
        $detail = ($lines | Select-Object -Last 12) -join [Environment]::NewLine
        throw "$Label failed with exit code $exitCode.$([Environment]::NewLine)$detail"
    }
    return $lines
}

function Read-PropertiesFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Signing properties file not found: $Path"
    }
    $properties = @{}
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) { continue }
        $parts = $trimmed -split '=', 2
        $properties[$parts[0].Trim()] = $parts[1].Trim()
    }
    return $properties
}

function Resolve-Toolchain {
    param([string]$ResolvedAppRoot)
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    $npx = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
    if (-not $node) { throw 'Node.js is unavailable.' }
    if (-not $npx) { throw 'npx.cmd is unavailable.' }

    $javaHome = $env:JAVA_HOME
    if (-not $javaHome -or -not (Test-Path -LiteralPath (Join-Path $javaHome 'bin\java.exe'))) {
        $javaHome = 'C:\Program Files\Android\Android Studio\jbr'
    }
    $java = Join-Path $javaHome 'bin\java.exe'
    $jarsigner = Join-Path $javaHome 'bin\jarsigner.exe'
    $keytool = Join-Path $javaHome 'bin\keytool.exe'
    foreach ($tool in @($java, $jarsigner, $keytool)) {
        if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) { throw "Java tool unavailable: $tool" }
    }
    $env:JAVA_HOME = $javaHome

    $localProperties = Join-Path $ResolvedAppRoot 'android\local.properties'
    if (-not (Test-Path -LiteralPath $localProperties -PathType Leaf)) {
        throw "Android SDK configuration unavailable: $localProperties"
    }
    $sdkLine = Get-Content -LiteralPath $localProperties -Encoding UTF8 |
        Where-Object { $_ -match '^sdk\.dir=' } |
        Select-Object -First 1
    if (-not $sdkLine) { throw 'sdk.dir is missing from android/local.properties.' }
    $sdkDir = (($sdkLine -split '=', 2)[1] -replace '\\\\', '\' -replace '\\:', ':').Trim()
    if (-not (Test-Path -LiteralPath $sdkDir -PathType Container)) { throw "Android SDK unavailable: $sdkDir" }

    $buildTools = Get-ChildItem -LiteralPath (Join-Path $sdkDir 'build-tools') -Directory |
        Sort-Object { try { [version]$_.Name } catch { [version]'0.0' } } -Descending |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'apksigner.bat') } |
        Select-Object -First 1
    if (-not $buildTools) { throw 'Android apksigner is unavailable.' }
    $apksigner = Join-Path $buildTools.FullName 'apksigner.bat'
    $apkanalyzer = Join-Path $sdkDir 'cmdline-tools\latest\bin\apkanalyzer.bat'
    if (-not (Test-Path -LiteralPath $apkanalyzer -PathType Leaf)) { throw 'Android apkanalyzer is unavailable.' }

    return [pscustomobject]@{
        Node = $node
        Npx = $npx
        JavaHome = $javaHome
        JarSigner = $jarsigner
        KeyTool = $keytool
        ApkSigner = $apksigner
        ApkAnalyzer = $apkanalyzer
    }
}

function Assert-SigningConfiguration {
    param(
        [string]$AndroidRoot,
        [string]$PropertiesPath,
        [object]$Toolchain
    )
    $properties = Read-PropertiesFile -Path $PropertiesPath
    foreach ($key in @('storeFile', 'storePassword', 'keyAlias', 'keyPassword')) {
        if (-not $properties.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($properties[$key])) {
            throw "Signing property is missing: $key"
        }
    }
    $keystorePath = Resolve-AbsolutePath -BasePath $AndroidRoot -Candidate $properties['storeFile']
    if (-not (Test-Path -LiteralPath $keystorePath -PathType Leaf)) {
        throw "Signing keystore not found: $keystorePath"
    }
    $certificate = Invoke-Checked -Label 'validating signing keystore and alias' `
        -FilePath $Toolchain.KeyTool `
        -Arguments @(
            '-J-Duser.language=en', '-J-Duser.country=US',
            '-list', '-v', '-keystore', $keystorePath,
            '-storepass', $properties['storePassword'], '-alias', $properties['keyAlias']
        ) `
        -WorkingDirectory $AndroidRoot -Quiet
    $certificateText = $certificate -join "`n"
    $match = [regex]::Match($certificateText, 'SHA256:\s*([A-Fa-f0-9:]+)')
    if (-not $match.Success) { throw 'Unable to read signing certificate SHA-256 fingerprint.' }
    $actualFingerprint = $match.Groups[1].Value.Replace(':', '').ToLowerInvariant()
    if ($actualFingerprint -ne $ExpectedSignerSha256) {
        throw "Signing certificate mismatch: $actualFingerprint"
    }
    return [pscustomobject]@{
        KeystorePath = $keystorePath
        Alias = $properties['keyAlias']
    }
}

function Assert-WebMirror {
    param([string]$ResolvedAppRoot, [string]$WebRoot)
    foreach ($relativePath in $ReleaseWebFiles) {
        $source = Join-Path (Join-Path $ResolvedAppRoot 'www') $relativePath
        $mirror = Join-Path $WebRoot $relativePath
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Source web file missing: $source" }
        if (-not (Test-Path -LiteralPath $mirror -PathType Leaf)) { throw "Mirrored web file missing: $mirror" }
        if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne
            (Get-FileHash -LiteralPath $mirror -Algorithm SHA256).Hash) {
            throw "Authoritative and mirrored web files differ: $relativePath"
        }
    }
}

function Assert-WebOnlyAssets {
    param([string]$WebRoot)
    foreach ($relativePath in $WebOnlyFiles) {
        $asset = Join-Path $WebRoot $relativePath
        if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) {
            throw "Web-only release asset missing: $asset"
        }
        if ((Get-Item -LiteralPath $asset).Length -le 0) {
            throw "Web-only release asset is empty: $asset"
        }
    }

    $manifestPath = Join-Path $WebRoot 'manifest.webmanifest'
    try { $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { throw "Invalid PWA manifest: $manifestPath`n$($_.Exception.Message)" }
    $manifestIcons = @($manifest.icons | ForEach-Object { $_.src })
    foreach ($icon in @('icon-192.png', 'icon-512.png')) {
        if ($manifestIcons -notcontains $icon) { throw "PWA manifest does not reference required icon: $icon" }
    }

    $serviceWorker = Get-Content -LiteralPath (Join-Path $WebRoot 'sw.js') -Raw -Encoding UTF8
    $precacheMatch = [regex]::Match(
        $serviceWorker,
        'const\s+PRECACHE\s*=\s*\[(?<entries>[\s\S]*?)\]\s*;'
    )
    if (-not $precacheMatch.Success) { throw 'Service worker PRECACHE inventory missing or malformed.' }
    $precacheEntries = @(
        [regex]::Matches(
            $precacheMatch.Groups['entries'].Value,
            "['`"](?<path>\./[^'`"]+)['`"]"
        ) | ForEach-Object { $_.Groups['path'].Value }
    )
    foreach ($relativePath in @('manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png')) {
        if ($precacheEntries -notcontains "./$relativePath") {
            throw "Service worker precache is missing web-only asset: $relativePath"
        }
    }
}

function Assert-CleanAndroidAssets {
    param([string]$ResolvedAppRoot)
    $sourceRoot = Join-Path $ResolvedAppRoot 'www'
    $assetRoot = Join-Path $ResolvedAppRoot 'android\app\src\main\assets\public'
    foreach ($relativePath in $ReleaseWebFiles) {
        $source = Join-Path $sourceRoot $relativePath
        $asset = Join-Path $assetRoot $relativePath
        if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) { throw "Android asset missing after clean sync: $relativePath" }
        if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne
            (Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash) {
            throw "Android asset is not clean after sync: $relativePath"
        }
    }
}

function Sync-CleanAssets {
    param([string]$ResolvedAppRoot, [object]$Toolchain)
    $null = Invoke-Checked -Label 'clean Capacitor sync' -FilePath $Toolchain.Npx `
        -Arguments @('cap', 'sync', 'android') -WorkingDirectory $ResolvedAppRoot
    Assert-CleanAndroidAssets -ResolvedAppRoot $ResolvedAppRoot
}

function Protect-AndroidAssets {
    param([string]$ResolvedAppRoot, [object]$Toolchain)
    $assetRoot = Join-Path $ResolvedAppRoot 'android\app\src\main\assets\public'
    $obfuscator = Join-Path $ResolvedAppRoot 'obfuscate_assets.js'
    $null = Invoke-Checked -Label 'obfuscating Android web assets' -FilePath $Toolchain.Node `
        -Arguments @($obfuscator, $assetRoot) -WorkingDirectory $ResolvedAppRoot
    foreach ($relativePath in $ProtectedFiles) {
        $source = Join-Path (Join-Path $ResolvedAppRoot 'www') $relativePath
        $protected = Join-Path $assetRoot $relativePath
        if ((Get-Item -LiteralPath $protected).Length -le 0) { throw "Protected asset is empty: $relativePath" }
        if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -eq
            (Get-FileHash -LiteralPath $protected -Algorithm SHA256).Hash) {
            throw "Obfuscation did not transform protected asset: $relativePath"
        }
    }
}

function Test-ProtectedAssets {
    param([string]$ResolvedAppRoot, [string]$WebRoot, [object]$Toolchain)
    $assetRoot = Join-Path $ResolvedAppRoot 'android\app\src\main\assets\public'
    $runner = Join-Path $WebRoot 'tests\ui-regression.js'
    $previousAppRoot = $env:APP_ROOT
    $previousUiRoot = $env:UI_ROOT
    $previousSkipSourceContracts = $env:SKIP_SOURCE_CONTRACTS
    try {
        $env:APP_ROOT = $ResolvedAppRoot
        $env:UI_ROOT = $assetRoot
        $env:SKIP_SOURCE_CONTRACTS = '1'
        $null = Invoke-Checked -Label 'protected UI regression' -FilePath $Toolchain.Node `
            -Arguments @($runner) -WorkingDirectory $WebRoot
    } finally {
        $env:APP_ROOT = $previousAppRoot
        $env:UI_ROOT = $previousUiRoot
        $env:SKIP_SOURCE_CONTRACTS = $previousSkipSourceContracts
    }
}

function Build-ReleaseArtifacts {
    param([string]$ResolvedAppRoot)
    $androidRoot = Join-Path $ResolvedAppRoot 'android'
    $gradle = Join-Path $androidRoot 'gradlew.bat'
    if (-not (Test-Path -LiteralPath $gradle -PathType Leaf)) { throw "Gradle wrapper unavailable: $gradle" }
    $null = Invoke-Checked -Label 'signed protected APK and AAB build' -FilePath $gradle `
        -Arguments @('clean', 'assembleRelease', 'bundleRelease', '--no-daemon') -WorkingDirectory $androidRoot
    $builtApk = Join-Path $androidRoot 'app\build\outputs\apk\release\app-release.apk'
    $builtAab = Join-Path $androidRoot 'app\build\outputs\bundle\release\app-release.aab'
    foreach ($artifact in @($builtApk, $builtAab)) {
        if (-not (Test-Path -LiteralPath $artifact -PathType Leaf) -or (Get-Item -LiteralPath $artifact).Length -le 0) {
            throw "Release artifact missing: $artifact"
        }
    }
}

function Copy-VerifiedByHash {
    param([string]$Source, [string]$Destination)
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    $sourceHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash
    if ($sourceHash -ne $destinationHash) { throw "Artifact copy hash mismatch: $Destination" }
    return $destinationHash
}

function Verify-ReleaseArtifacts {
    param([string]$ResolvedApkPath, [string]$ResolvedAabPath, [object]$Toolchain)
    foreach ($artifact in @($ResolvedApkPath, $ResolvedAabPath)) {
        if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) { throw "Artifact unavailable for verification: $artifact" }
    }

    try {
        $apkOutput = Invoke-Checked -Label 'APK signature verification' -FilePath $Toolchain.ApkSigner `
            -Arguments @('verify', '--verbose', '--print-certs', $ResolvedApkPath) `
            -WorkingDirectory (Split-Path -Parent $ResolvedApkPath) -Quiet
    } catch {
        throw "APK signature verification failed. $($_.Exception.Message)"
    }
    $apkText = $apkOutput -join "`n"
    if ($apkText -notmatch 'Verified using v2 scheme \(APK Signature Scheme v2\): true') {
        throw 'APK signature verification failed. APK Signature Scheme v2 is not true.'
    }
    if ($apkText -notmatch 'Number of signers:\s*1') {
        throw 'APK signature verification failed. Expected exactly one signer.'
    }
    $apkFingerprintMatch = [regex]::Match($apkText, 'certificate SHA-256 digest:\s*([A-Fa-f0-9]+)')
    if (-not $apkFingerprintMatch.Success -or
        $apkFingerprintMatch.Groups[1].Value.ToLowerInvariant() -ne $ExpectedSignerSha256) {
        throw 'APK signature verification failed. Signing identity does not match the pinned certificate.'
    }

    $jarOutput = Invoke-Checked -Label 'AAB JAR signature verification' -FilePath $Toolchain.JarSigner `
        -Arguments @('-J-Duser.language=en', '-J-Duser.country=US', '-verify', '-verbose', '-certs', $ResolvedAabPath) `
        -WorkingDirectory (Split-Path -Parent $ResolvedAabPath) -Quiet
    if (($jarOutput -join "`n") -notmatch 'jar verified\.') { throw 'AAB signature verification failed.' }
    $aabCertificate = Invoke-Checked -Label 'AAB signing identity verification' -FilePath $Toolchain.KeyTool `
        -Arguments @('-J-Duser.language=en', '-J-Duser.country=US', '-printcert', '-jarfile', $ResolvedAabPath) `
        -WorkingDirectory (Split-Path -Parent $ResolvedAabPath) -Quiet
    $aabFingerprintMatch = [regex]::Match(($aabCertificate -join "`n"), 'SHA256:\s*([A-Fa-f0-9:]+)')
    $aabFingerprint = if ($aabFingerprintMatch.Success) {
        $aabFingerprintMatch.Groups[1].Value.Replace(':', '').ToLowerInvariant()
    } else { '' }
    if ($aabFingerprint -ne $ExpectedSignerSha256) { throw 'AAB signing identity does not match the pinned certificate.' }

    $manifest = Invoke-Checked -Label 'delivered APK manifest verification' -FilePath $Toolchain.ApkAnalyzer `
        -Arguments @('manifest', 'print', $ResolvedApkPath) `
        -WorkingDirectory (Split-Path -Parent $ResolvedApkPath) -Quiet
    $manifestText = $manifest -join "`n"
    if ($manifestText -notmatch 'android:allowBackup="false"' -or $manifestText -match 'android:allowBackup="true"') {
        throw 'Delivered APK manifest verification failed: android:allowBackup="false" is required.'
    }

    $apkHash = (Get-FileHash -LiteralPath $ResolvedApkPath -Algorithm SHA256).Hash
    $aabHash = (Get-FileHash -LiteralPath $ResolvedAabPath -Algorithm SHA256).Hash
    Write-Host "[release] APK_SHA256=$apkHash"
    Write-Host "[release] AAB_SHA256=$aabHash"
    Write-Host "[release] SIGNER_SHA256=$ExpectedSignerSha256"
    Write-Host '[release] APK_V2=true'
    Write-Host '[release] APK_ALLOW_BACKUP=false'
    Write-Host '[release] AAB_JAR_VERIFIED=true'
    return [pscustomobject]@{ ApkHash = $apkHash; AabHash = $aabHash }
}

function Restore-CleanAssets {
    param([string]$ResolvedAppRoot, [object]$Toolchain)
    Sync-CleanAssets -ResolvedAppRoot $ResolvedAppRoot -Toolchain $Toolchain
    Write-Host '[release] CLEAN_RESTORE=true'
}

$WebRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($AppRoot)) {
    if (-not [string]::IsNullOrWhiteSpace($env:APP_ROOT)) { $AppRoot = $env:APP_ROOT }
    else { $AppRoot = Join-Path $WebRoot '..' }
}
$ResolvedAppRoot = Resolve-AbsolutePath -BasePath $WebRoot -Candidate $AppRoot
if (-not (Test-Path -LiteralPath $ResolvedAppRoot -PathType Container)) { throw "App root unavailable: $ResolvedAppRoot" }
$AndroidRoot = Join-Path $ResolvedAppRoot 'android'
if ([string]::IsNullOrWhiteSpace($SigningPropertiesPath)) {
    $SigningPropertiesPath = Join-Path $AndroidRoot 'keystore.properties'
} else {
    $SigningPropertiesPath = Resolve-AbsolutePath -BasePath $WebRoot -Candidate $SigningPropertiesPath
}
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path (Split-Path -Parent $ResolvedAppRoot) 'outputs\2026-07-24-apple-redesign'
} else {
    $OutputDir = Resolve-AbsolutePath -BasePath $WebRoot -Candidate $OutputDir
}

$toolchain = Resolve-Toolchain -ResolvedAppRoot $ResolvedAppRoot
$null = Assert-SigningConfiguration -AndroidRoot $AndroidRoot -PropertiesPath $SigningPropertiesPath -Toolchain $toolchain

if ($PreflightOnly) {
    Assert-WebMirror -ResolvedAppRoot $ResolvedAppRoot -WebRoot $WebRoot
    Assert-WebOnlyAssets -WebRoot $WebRoot
    Write-Host '[release] PREFLIGHT=true'
    return
}

if ($VerifyOnly) {
    if ([string]::IsNullOrWhiteSpace($ApkPath) -or [string]::IsNullOrWhiteSpace($AabPath)) {
        throw 'VerifyOnly requires both ApkPath and AabPath.'
    }
    $ResolvedApkPath = Resolve-AbsolutePath -BasePath $WebRoot -Candidate $ApkPath
    $ResolvedAabPath = Resolve-AbsolutePath -BasePath $WebRoot -Candidate $AabPath
    $null = Verify-ReleaseArtifacts -ResolvedApkPath $ResolvedApkPath -ResolvedAabPath $ResolvedAabPath -Toolchain $toolchain
    return
}

Assert-WebMirror -ResolvedAppRoot $ResolvedAppRoot -WebRoot $WebRoot
Assert-WebOnlyAssets -WebRoot $WebRoot
if (-not (Test-Path -LiteralPath $OutputDir -PathType Container)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$restoreRequired = $true
try {
    Sync-CleanAssets -ResolvedAppRoot $ResolvedAppRoot -Toolchain $toolchain
    Protect-AndroidAssets -ResolvedAppRoot $ResolvedAppRoot -Toolchain $toolchain
    Test-ProtectedAssets -ResolvedAppRoot $ResolvedAppRoot -WebRoot $WebRoot -Toolchain $toolchain
    $null = Build-ReleaseArtifacts -ResolvedAppRoot $ResolvedAppRoot
    $builtApk = Join-Path $AndroidRoot 'app\build\outputs\apk\release\app-release.apk'
    $builtAab = Join-Path $AndroidRoot 'app\build\outputs\bundle\release\app-release.aab'
    $deliveredApk = Join-Path $OutputDir "$ArtifactBaseName.apk"
    $deliveredAab = Join-Path $OutputDir "$ArtifactBaseName.aab"
    $null = Copy-VerifiedByHash -Source $builtApk -Destination $deliveredApk
    $null = Copy-VerifiedByHash -Source $builtAab -Destination $deliveredAab
    $null = Verify-ReleaseArtifacts -ResolvedApkPath $deliveredApk -ResolvedAabPath $deliveredAab -Toolchain $toolchain
    Write-Host '[release] BUILD_PROTECTED=true'
} finally {
    if ($restoreRequired) { Restore-CleanAssets -ResolvedAppRoot $ResolvedAppRoot -Toolchain $toolchain }
}
