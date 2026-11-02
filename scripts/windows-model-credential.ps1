param(
  [ValidateSet('status', 'save', 'read', 'forget')][string]$Mode,
  [string]$Service,
  [string]$Username
)
$ErrorActionPreference = 'Stop'
try {
  $credentialDirectory = Join-Path $env:LOCALAPPDATA 'WarhallPublisher\Credentials'
  $sha = [Security.Cryptography.SHA256]::Create()
  $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Service + "`n" + $Username))).Replace('-', '').ToLowerInvariant()
  $credentialFile = Join-Path $credentialDirectory ($hash + '.dpapi')
  switch ($Mode) {
    'status' { if (Test-Path -LiteralPath $credentialFile) { exit 0 } else { exit 1 } }
    'save' {
      $secret = Read-Host "Warhall password for $Username (hidden)" -AsSecureString
      if ($secret.Length -eq 0) { throw 'Empty password' }
      New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
      $secret | ConvertFrom-SecureString | Set-Content -LiteralPath $credentialFile -Encoding ASCII
      $secret.Dispose()
    }
    'read' {
      $secret = Get-Content -LiteralPath $credentialFile -Raw | ConvertTo-SecureString
      $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
      try { [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); [Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)) }
      finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secret.Dispose() }
    }
    'forget' { if (Test-Path -LiteralPath $credentialFile) { Remove-Item -LiteralPath $credentialFile } }
  }
} catch {
  [Console]::Error.WriteLine('Windows credential operation failed. Enroll again in your own terminal if needed.')
  exit 2
}
