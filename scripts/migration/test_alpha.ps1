$secpasswd = ConvertTo-SecureString "alpha-Omega-911" -AsPlainText -Force
$mycreds = New-Object System.Management.Automation.PSCredential ("Gigi_Admin", $secpasswd)

try {
    Write-Host "Testing connection to Alpha..."
    Invoke-Command -ComputerName 100.116.12.18 -Credential $mycreds -ScriptBlock { 
        Write-Host "Successfully connected to Alpha."
        Get-ChildItem C:\
    }
} catch {
    Write-Host "Failed: $($_.Exception.Message)"
}
