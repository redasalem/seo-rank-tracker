$baseUrl = "https://seo-rank-tracer-server.vercel.app"

function Test-Endpoint {
    param([string]$Path, [string]$Method="GET", [string]$Body=$null)
    $uri = "$baseUrl$Path"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        if ($Body) {
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Body $Body -ContentType "application/json" -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method $Method -ErrorAction Stop
        }
        $sw.Stop()
        Write-Host "URL: $uri"
        Write-Host "Method: $Method"
        Write-Host "Status: $($response.StatusCode)"
        Write-Host "Time: $($sw.ElapsedMilliseconds) ms"
        Write-Host "Response: $($response.Content)"
        Write-Host "---------------------------"
    } catch {
        $sw.Stop()
        Write-Host "URL: $uri"
        Write-Host "Method: $Method"
        
        if ($_.Exception.Response) {
            Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $content = $reader.ReadToEnd()
            Write-Host "Response: $content"
        } else {
            Write-Host "Error: $($_.Exception.Message)"
        }
        Write-Host "Time: $($sw.ElapsedMilliseconds) ms"
        Write-Host "---------------------------"
    }
}

Test-Endpoint -Path "/"
Test-Endpoint -Path "/api/auth/login" -Method "POST" -Body "{}"
Test-Endpoint -Path "/api/rank"
Test-Endpoint -Path "/api/cron/daily"
