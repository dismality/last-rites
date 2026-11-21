# Brings the newest Chrome window whose title has the given text to the front, so the page can
# take pointer lock. Windows refuses a plain SetForegroundWindow from a background process; a
# tapped Alt key first lifts that lock.
param([string]$Title = 'Last Rites')
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Fg {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
}
'@
$p = Get-Process chrome -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$Title*" } |
  Sort-Object StartTime -Descending | Select-Object -First 1
if (-not $p) { Write-Output 'no window'; exit 1 }
[Fg]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
[Fg]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
[void][Fg]::ShowWindow($p.MainWindowHandle, 5)
$ok = [Fg]::SetForegroundWindow($p.MainWindowHandle)
Write-Output "focused=$ok"
