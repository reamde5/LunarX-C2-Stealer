# Script para actualizar la URL del servidor en todos los configs
param(
    [Parameter(Mandatory=$true)]
    [string]$NewUrl
)

Write-Host "🔧 Actualizando URL del servidor a: $NewUrl" -ForegroundColor Cyan
Write-Host ""

# Actualizar agent/config.json
$agentConfig = "agent\config.json"
if (Test-Path $agentConfig) {
    $config = Get-Content $agentConfig | ConvertFrom-Json
    $config.serverUrl = $NewUrl
    $config | ConvertTo-Json | Set-Content $agentConfig
    Write-Host "✅ Actualizado: $agentConfig" -ForegroundColor Green
}

# Actualizar DEFENDER-Agent-Distributable/config.json
$distConfig = "DEFENDER-Agent-Distributable\config.json"
if (Test-Path $distConfig) {
    $config = Get-Content $distConfig | ConvertFrom-Json
    $config.serverUrl = $NewUrl
    $config | ConvertTo-Json | Set-Content $distConfig
    Write-Host "✅ Actualizado: $distConfig" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Configuración actualizada!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Recompilar el agente: cd agent && npm run build"
Write-Host "  2. Copiar a distributable: Copy-Item agent\defender-agent.exe DEFENDER-Agent-Distributable\"
Write-Host "  3. Crear ZIP: Compress-Archive -Path DEFENDER-Agent-Distributable\* -DestinationPath LunarX-Agent-v2.0.zip -Force"
Write-Host ""
