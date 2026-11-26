param(
  [ValidateSet('status', 'save', 'read', 'forget')][string]$Mode,
  [string]$Service,
  [string]$Username
)
$ErrorActionPreference = 'Stop'
# Node may inherit PowerShell 7 module paths; use Windows PowerShell's own security module.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$stage = 2
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
      $stage = 10
      $encrypted = (Get-Content -LiteralPath $credentialFile -Raw).Trim()
      if ($encrypted -notmatch '^[a-fA-F0-9]+$') { $stage = 15; throw 'Invalid encrypted record' }
      $stage = 11
      $secret = ConvertTo-SecureString -String $encrypted
      $stage = 12
      $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
      try { $stage = 13; [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $stage = 14; [Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)) }
      finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secret.Dispose() }
    }
    'forget' { if (Test-Path -LiteralPath $credentialFile) { Remove-Item -LiteralPath $credentialFile } }
  }
} catch {
  [Console]::Error.WriteLine('Windows credential operation failed. Enroll again in your own terminal if needed.')
  if ($stage -eq 11) {
    switch ($_.Exception.GetBaseException().GetType().Name) {
      'CryptographicException' { exit 21 }
      'FormatException' { exit 22 }
      'ArgumentException' { exit 23 }
    }
  }
  exit $stage
}
