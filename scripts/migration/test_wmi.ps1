$secpasswd = ConvertTo-SecureString "alpha-Omega-911" -AsPlainText -Force
$mycreds = New-Object System.Management.Automation.PSCredential ("Gigi_Admin", $secpasswd)

try {
    Write-Host "Testing WMI connection to Alpha..."
    $result = Invoke-WmiMethod -ComputerName 100.116.12.18 -Credential $mycreds -Class Win32_Process -Name Create -ArgumentList "cmd.exe /c echo test > C:\wmitest.txt"
    Write-Host "Return Value: $($result.ReturnValue)"
    Write-Host "Process ID: $($result.ProcessId)"
} catch {
    Write-Host "Failed: $($_.Exception.Message)"
}
