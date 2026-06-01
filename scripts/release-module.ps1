param(
  [string] $Module = ".",
  [string] $FoundryCliVersion = "3.0.3",
  [string] $RemoteName = "origin",
  [string] $Repository,
  [string] $GitHubToken = $env:GITHUB_TOKEN,
  [switch] $NoVersionBump,
  [switch] $SkipValidate,
  [switch] $SkipPacks,
  [switch] $SkipZip,
  [switch] $SkipRelease
)

$ErrorActionPreference = "Stop"
$Utf8NoBomStrict = [System.Text.UTF8Encoding]::new($false, $true)
$OutputEncoding = $Utf8NoBomStrict
try {
  [Console]::InputEncoding = $Utf8NoBomStrict
  [Console]::OutputEncoding = $Utf8NoBomStrict
} catch {
  # Non-interactive hosts may not expose console encoding controls.
}
$EmbeddedCollections = @{
  actors = @("items", "effects")
  cards = @("cards")
  combats = @("combatants", "groups")
  delta = @("items", "effects")
  effects = @()
  items = @("effects")
  journal = @("pages", "categories")
  playlists = @("sounds")
  regions = @("behaviors")
  tables = @("results")
  tokens = @("delta")
  scenes = @("drawings", "lights", "notes", "regions", "sounds", "templates", "tokens", "tiles", "walls")
}

function Resolve-FullPath {
  param([string] $Path)
  return [System.IO.Path]::GetFullPath((Resolve-Path $Path).Path)
}

function Assert-ChildPath {
  param(
    [string] $BasePath,
    [string] $TargetPath
  )

  $base = [System.IO.Path]::GetFullPath($BasePath).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $target = [System.IO.Path]::GetFullPath($TargetPath)
  $prefix = $base + [System.IO.Path]::DirectorySeparatorChar

  if (-not ($target.Equals($base, [System.StringComparison]::OrdinalIgnoreCase) -or $target.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase))) {
    throw "Refusing to touch path outside ${base}: ${target}"
  }
}

function Write-JsonFile {
  param(
    [string] $Path,
    [object] $Value
  )

  $json = $Value | ConvertTo-Json -Depth 100
  $json = $json.Replace('\u0026', '&').Replace('\u003c', '<').Replace('\u003e', '>').Replace('\u0027', "'")
  [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, $script:Utf8NoBomStrict)
}

function Read-JsonFile {
  param([string] $Path)

  $json = [System.IO.File]::ReadAllText($Path, $script:Utf8NoBomStrict)
  return $json | ConvertFrom-Json
}

function Add-OrSetJsonProperty {
  param(
    [object] $Object,
    [string] $Name,
    [object] $Value
  )

  if ($Object.PSObject.Properties.Name -contains $Name) {
    $Object.$Name = $Value
  } else {
    $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
  }
}

function New-DeterministicId {
  param([string] $Seed)

  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Seed)
    $hash = $sha1.ComputeHash($bytes)
    return (($hash | ForEach-Object { $_.ToString("x2") }) -join "").Substring(0, 16)
  } finally {
    $sha1.Dispose()
  }
}

function Get-NextPatchVersion {
  param([string] $Version)

  if ($Version -notmatch "^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$") {
    throw "Cannot bump version '$Version'. Expected semver like 1.0.0."
  }

  $major = [int] $Matches[1]
  $minor = [int] $Matches[2]
  $patch = [int] $Matches[3] + 1
  return "$major.$minor.$patch"
}

function Get-DocumentCollection {
  param([string] $DocumentType)

  $collections = @{
    ActiveEffect = "effects"
    Actor = "actors"
    Adventure = "adventures"
    Cards = "cards"
    ChatMessage = "messages"
    Combat = "combats"
    FogExploration = "fog"
    Folder = "folders"
    Item = "items"
    JournalEntry = "journal"
    Macro = "macros"
    Playlist = "playlists"
    RollTable = "tables"
    Scene = "scenes"
    Setting = "settings"
    User = "users"
  }

  if (-not $collections.ContainsKey($DocumentType)) {
    throw "Unsupported compendium document type: $DocumentType"
  }

  return $collections[$DocumentType]
}

function Add-DocumentKeys {
  param(
    [object] $Document,
    [string] $Collection,
    [string] $CollectionPrefix = $Collection,
    [string] $IdPrefix = $Document._id
  )

  if ([string]::IsNullOrWhiteSpace($Document._id)) {
    throw "Missing _id while assigning a $Collection key."
  }

  Add-OrSetJsonProperty -Object $Document -Name "_key" -Value "!$CollectionPrefix!$IdPrefix"

  if (-not $script:EmbeddedCollections.ContainsKey($Collection)) {
    return
  }

  foreach ($embeddedCollection in $script:EmbeddedCollections[$Collection]) {
    $embeddedValue = $Document.$embeddedCollection
    if ($null -eq $embeddedValue) {
      continue
    }

    if ($embeddedValue -is [System.Array]) {
      for ($index = 0; $index -lt $embeddedValue.Count; $index++) {
        $embeddedDocument = $embeddedValue[$index]
        if ($null -eq $embeddedDocument) {
          continue
        }

        if ([string]::IsNullOrWhiteSpace($embeddedDocument._id)) {
          $label = ""
          if ($embeddedDocument.PSObject.Properties.Name -contains "name") {
            $label = [string] $embeddedDocument.name
          } elseif ($embeddedDocument.PSObject.Properties.Name -contains "label") {
            $label = [string] $embeddedDocument.label
          } elseif ($embeddedDocument.PSObject.Properties.Name -contains "type") {
            $label = [string] $embeddedDocument.type
          }

          Add-OrSetJsonProperty `
            -Object $embeddedDocument `
            -Name "_id" `
            -Value (New-DeterministicId -Seed "${IdPrefix}:${embeddedCollection}:${index}:${label}")
        }

        Add-DocumentKeys `
          -Document $embeddedDocument `
          -Collection $embeddedCollection `
          -CollectionPrefix "$CollectionPrefix.$embeddedCollection" `
          -IdPrefix "$IdPrefix.$($embeddedDocument._id)"
      }
    } elseif ($null -ne $embeddedValue) {
      if ([string]::IsNullOrWhiteSpace($embeddedValue._id)) {
        $label = ""
        if ($embeddedValue.PSObject.Properties.Name -contains "name") {
          $label = [string] $embeddedValue.name
        } elseif ($embeddedValue.PSObject.Properties.Name -contains "label") {
          $label = [string] $embeddedValue.label
        } elseif ($embeddedValue.PSObject.Properties.Name -contains "type") {
          $label = [string] $embeddedValue.type
        }

        Add-OrSetJsonProperty `
          -Object $embeddedValue `
          -Name "_id" `
          -Value (New-DeterministicId -Seed "${IdPrefix}:${embeddedCollection}:0:${label}")
      }

      Add-DocumentKeys `
        -Document $embeddedValue `
        -Collection $embeddedCollection `
        -CollectionPrefix "$CollectionPrefix.$embeddedCollection" `
        -IdPrefix "$IdPrefix.$($embeddedValue._id)"
    }
  }
}

function Get-GitHubRepositoryFromRemote {
  param(
    [string] $ModuleRoot,
    [string] $Remote
  )

  $remoteUrl = (& git -C $ModuleRoot remote get-url $Remote 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteUrl)) {
    return $null
  }

  $remoteUrl = $remoteUrl.Trim()
  if ($remoteUrl -match "github\.com[:/]([^/]+/[^/.]+)(?:\.git)?$") {
    return $Matches[1]
  }

  return $null
}

function Get-GitHubRepository {
  param(
    [object] $Manifest,
    [string] $ModuleRoot,
    [string] $Remote
  )

  if ($script:Repository) {
    return $script:Repository.TrimEnd("/")
  }

  if ($Manifest.url -and $Manifest.url -match "github\.com[:/]([^/]+/[^/.]+)(?:\.git)?/?$") {
    return $Matches[1]
  }

  $repoFromRemote = Get-GitHubRepositoryFromRemote -ModuleRoot $ModuleRoot -Remote $Remote
  if ($repoFromRemote) {
    return $repoFromRemote
  }

  throw "Cannot determine GitHub repository. Pass -Repository owner/repo or set module.json url / git remote."
}

function Invoke-NodeScriptIfPresent {
  param(
    [string] $ModuleRoot,
    [string] $RelativeScript
  )

  $scriptPath = Join-Path $ModuleRoot $RelativeScript
  if (-not (Test-Path $scriptPath -PathType Leaf)) {
    return
  }

  Write-Host "Running $RelativeScript"
  Push-Location $ModuleRoot
  try {
    & node $scriptPath
    if ($LASTEXITCODE -ne 0) {
      throw "$RelativeScript failed."
    }
  } finally {
    Pop-Location
  }
}

function Invoke-FoundryCli {
  param(
    [string] $ModuleRoot,
    [string[]] $Arguments
  )

  $localCli = Join-Path $ModuleRoot "node_modules/@foundryvtt/foundryvtt-cli/fvtt.mjs"
  Push-Location $ModuleRoot
  try {
    if (Test-Path $localCli -PathType Leaf) {
      & node $localCli @Arguments
    } else {
      & npx --yes "@foundryvtt/foundryvtt-cli@$FoundryCliVersion" @Arguments
    }

    if ($LASTEXITCODE -ne 0) {
      throw "Foundry VTT CLI failed."
    }
  } finally {
    Pop-Location
  }
}

function Build-CompendiumPacks {
  param(
    [string] $ModuleRoot,
    [object] $Manifest
  )

  $sourcePacksRoot = Join-Path $ModuleRoot "src/packs"
  $packRoot = Join-Path $ModuleRoot "packs"
  $packBuildRoot = Join-Path $ModuleRoot "dist/pack-build"
  $packSourceRoot = Join-Path $ModuleRoot "dist/pack-source"

  if (-not (Test-Path $sourcePacksRoot -PathType Container)) {
    throw "Source packs directory was not found: $sourcePacksRoot"
  }

  Assert-ChildPath -BasePath $ModuleRoot -TargetPath $packRoot
  Assert-ChildPath -BasePath $ModuleRoot -TargetPath $packBuildRoot
  Assert-ChildPath -BasePath $ModuleRoot -TargetPath $packSourceRoot

  if (Test-Path $packBuildRoot) {
    Remove-Item -LiteralPath $packBuildRoot -Recurse -Force
  }
  if (Test-Path $packSourceRoot) {
    Remove-Item -LiteralPath $packSourceRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $packBuildRoot | Out-Null
  New-Item -ItemType Directory -Force -Path $packSourceRoot | Out-Null

  foreach ($pack in $Manifest.packs) {
    $packName = $pack.name
    if ([string]::IsNullOrWhiteSpace($packName)) {
      $packName = Split-Path $pack.path -Leaf
    }

    $packPathLeaf = Split-Path $pack.path -Leaf
    if ($packPathLeaf -ne $packName) {
      throw "Pack name '$packName' does not match manifest path '$($pack.path)'."
    }

    $sourcePath = Join-Path $sourcePacksRoot $packName
    $stagedSourcePath = Join-Path $packSourceRoot $packName
    $outputPath = Join-Path $packBuildRoot $packName
    Assert-ChildPath -BasePath $sourcePacksRoot -TargetPath $sourcePath
    Assert-ChildPath -BasePath $packSourceRoot -TargetPath $stagedSourcePath
    Assert-ChildPath -BasePath $packBuildRoot -TargetPath $outputPath

    if (-not (Test-Path $sourcePath -PathType Container)) {
      throw "Missing source directory for pack '$packName': $sourcePath"
    }

    $collection = Get-DocumentCollection -DocumentType $pack.type
    $sourcePathPrefix = [System.IO.Path]::GetFullPath($sourcePath).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    foreach ($sourceFile in Get-ChildItem -LiteralPath $sourcePath -Recurse -Filter "*.json" -File) {
      $relativePath = [System.IO.Path]::GetFullPath($sourceFile.FullName).Substring($sourcePathPrefix.Length)
      $stagedFile = Join-Path $stagedSourcePath $relativePath
      New-Item -ItemType Directory -Force -Path (Split-Path $stagedFile -Parent) | Out-Null

      $document = Read-JsonFile -Path $sourceFile.FullName
      if ([string]::IsNullOrWhiteSpace($document._id)) {
        throw "Missing _id in $($sourceFile.FullName)"
      }
      Add-DocumentKeys -Document $document -Collection $collection
      Write-JsonFile -Path $stagedFile -Value $document
    }

    Write-Host "Packing $packName"
    Invoke-FoundryCli -ModuleRoot $ModuleRoot -Arguments @(
      "package",
      "pack",
      $packName,
      "--inputDirectory",
      $stagedSourcePath,
      "--outputDirectory",
      $packBuildRoot,
      "--recursive"
    )

    $levelDbFiles = @(Get-ChildItem -LiteralPath $outputPath -Filter "*.ldb" -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 0 })
    if ($levelDbFiles.Count -eq 0) {
      throw "Pack '$packName' was created without LevelDB data. Check staged _key values."
    }
  }

  if (Test-Path $packRoot) {
    Remove-Item -LiteralPath $packRoot -Recurse -Force
  }
  Move-Item -LiteralPath $packBuildRoot -Destination $packRoot
  Remove-Item -LiteralPath $packSourceRoot -Recurse -Force
}

function Copy-RuntimeEntry {
  param(
    [string] $ModuleRoot,
    [string] $StageRoot,
    [string] $Entry
  )

  $source = Join-Path $ModuleRoot $Entry
  if (-not (Test-Path $source)) {
    throw "Runtime entry is missing: $source"
  }

  $destination = Join-Path $StageRoot $Entry
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

function Add-RuntimeEntry {
  param(
    [System.Collections.Generic.HashSet[string]] $Entries,
    [string] $Entry
  )

  if ([string]::IsNullOrWhiteSpace($Entry)) {
    return
  }

  $normalized = $Entry.Replace("\", "/").TrimStart("/")
  $topLevel = ($normalized -split "/")[0]
  [void] $Entries.Add($topLevel)
}

function New-ReleaseZip {
  param(
    [string] $ModuleRoot,
    [object] $Manifest
  )

  $distRoot = Join-Path $ModuleRoot "dist"
  $stageRoot = Join-Path $distRoot "stage"
  $moduleStageRoot = Join-Path $stageRoot $Manifest.id
  $zipPath = Join-Path $distRoot "$($Manifest.id).zip"

  Assert-ChildPath -BasePath $ModuleRoot -TargetPath $distRoot
  if (Test-Path $stageRoot) {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $moduleStageRoot | Out-Null

  $runtimeEntries = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  [void] $runtimeEntries.Add("module.json")

  foreach ($candidate in @("README.md", "readme.md", "lang", "packs")) {
    if (Test-Path (Join-Path $ModuleRoot $candidate)) {
      [void] $runtimeEntries.Add($candidate)
    }
  }

  foreach ($pathValue in @($Manifest.scripts) + @($Manifest.esmodules) + @($Manifest.styles)) {
    Add-RuntimeEntry -Entries $runtimeEntries -Entry $pathValue
  }

  foreach ($language in @($Manifest.languages)) {
    Add-RuntimeEntry -Entries $runtimeEntries -Entry $language.path
  }

  foreach ($pack in @($Manifest.packs)) {
    Add-RuntimeEntry -Entries $runtimeEntries -Entry $pack.path
  }

  foreach ($entry in ($runtimeEntries | Sort-Object)) {
    Copy-RuntimeEntry -ModuleRoot $ModuleRoot -StageRoot $moduleStageRoot -Entry $entry
  }

  if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }

  Compress-Archive -Path $moduleStageRoot -DestinationPath $zipPath -Force
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
  Write-Host "Created $zipPath"
  return $zipPath
}

function Publish-GitHubRelease {
  param(
    [string] $Repository,
    [string] $Tag,
    [string] $Version,
    [string] $Token,
    [string[]] $AssetPaths
  )

  if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "GITHUB_TOKEN is required to publish a GitHub release."
  }

  $headers = @{
    Authorization = "Bearer $Token"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent" = "warhammer-to-dnd-release"
  }

  $releaseUri = "https://api.github.com/repos/$Repository/releases/tags/$Tag"
  try {
    $release = Invoke-RestMethod -Method Get -Uri $releaseUri -Headers $headers
    Write-Host "Using existing GitHub release $Tag"
  } catch {
    $createBody = @{
      tag_name = $Tag
      name = $Tag
      body = "Release $Version"
      draft = $false
      prerelease = $false
    } | ConvertTo-Json

    Write-Host "Creating GitHub release $Repository $Tag"
    $release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$Repository/releases" -Headers $headers -Body $createBody -ContentType "application/json"
  }

  $assets = Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/$Repository/releases/$($release.id)/assets" -Headers $headers
  foreach ($assetPath in $AssetPaths) {
    if (-not (Test-Path $assetPath -PathType Leaf)) {
      throw "Release asset was not found: $assetPath"
    }

    $assetName = Split-Path $assetPath -Leaf
    foreach ($asset in @($assets | Where-Object { $_.name -eq $assetName })) {
      Write-Host "Replacing existing asset $assetName"
      Invoke-RestMethod -Method Delete -Uri $asset.url -Headers $headers | Out-Null
    }

    $uploadBase = $release.upload_url -replace "\{\?name,label\}$", ""
    $uploadUri = $uploadBase + "?name=" + [System.Uri]::EscapeDataString($assetName)
    Write-Host "Uploading $assetName"
    Invoke-RestMethod -Method Post -Uri $uploadUri -Headers $headers -ContentType "application/octet-stream" -InFile $assetPath | Out-Null
  }
}

$moduleRoot = Resolve-FullPath $Module
$manifestPath = Join-Path $moduleRoot "module.json"
if (-not (Test-Path $manifestPath -PathType Leaf)) {
  throw "module.json was not found in $moduleRoot"
}

$manifest = Read-JsonFile -Path $manifestPath
$repositoryName = Get-GitHubRepository -Manifest $manifest -ModuleRoot $moduleRoot -Remote $RemoteName

if (-not $SkipValidate) {
  Invoke-NodeScriptIfPresent -ModuleRoot $moduleRoot -RelativeScript "scripts/validate.mjs"
}

if (-not $SkipPacks) {
  Build-CompendiumPacks -ModuleRoot $moduleRoot -Manifest $manifest
}

if (-not $NoVersionBump) {
  $oldVersion = $manifest.version
  $newVersion = Get-NextPatchVersion -Version $oldVersion
  $manifest.version = $newVersion
  Write-Host "Version: $oldVersion -> $newVersion"
} else {
  $newVersion = $manifest.version
  Write-Host "Version bump skipped; using $newVersion"
}

$tag = "v$newVersion"
Add-OrSetJsonProperty -Object $manifest -Name "url" -Value "https://github.com/$repositoryName"
Add-OrSetJsonProperty -Object $manifest -Name "manifest" -Value "https://github.com/$repositoryName/releases/latest/download/module.json"
Add-OrSetJsonProperty -Object $manifest -Name "download" -Value "https://github.com/$repositoryName/releases/download/$tag/$($manifest.id).zip"
Write-JsonFile -Path $manifestPath -Value $manifest

$zipPath = $null
if (-not $SkipZip) {
  $zipPath = New-ReleaseZip -ModuleRoot $moduleRoot -Manifest $manifest
}

if (-not $SkipRelease) {
  if ($null -eq $zipPath) {
    $zipPath = Join-Path (Join-Path $moduleRoot "dist") "$($manifest.id).zip"
  }

  Publish-GitHubRelease -Repository $repositoryName -Tag $tag -Version $newVersion -Token $GitHubToken -AssetPaths @($manifestPath, $zipPath)
}
