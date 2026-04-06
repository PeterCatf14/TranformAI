$root = "C:\windows\Temp\TransformAI"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host ""
Write-Host "=== TransformAI Server ==="
Write-Host "  Local:   http://localhost:8080"
Write-Host "  Movil:   http://10.0.0.49:8080"
Write-Host "=========================="
Write-Host ""

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $localPath = $context.Request.Url.LocalPath
    if ($localPath -eq "/") { $localPath = "/index.html" }
    $filePath = Join-Path $root ($localPath.TrimStart("/"))
    $response = $context.Response

    if (Test-Path $filePath) {
        $content = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath)
        $response.ContentType = switch ($ext) {
            ".html" { "text/html;charset=utf-8" }
            ".css"  { "text/css;charset=utf-8" }
            ".js"   { "application/javascript;charset=utf-8" }
            ".json" { "application/json;charset=utf-8" }
            ".png"  { "image/png" }
            ".webp" { "image/webp" }
            default { "application/octet-stream" }
        }
        $response.ContentLength64 = $content.Length
        $response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        $response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $response.OutputStream.Close()
}
