<#
 Cria no Windows a tarefa "Financy - Renovar sessao Meu Pluggy": roda
 `npm run meupluggy:renew` a cada 12 horas e, se o PC estava desligado no horário,
 roda assim que ligar. Só precisa do PC ligado; não usa o Claude nem gasta tokens.
 Use depois de `npm run meupluggy:setup`. Para remover:
   Unregister-ScheduledTask -TaskName "Financy - Renovar sessao Meu Pluggy" -Confirm:$false
#>
$project = Split-Path -Parent $PSScriptRoot
$name = "Financy - Renovar sessao Meu Pluggy"
$npm = (Get-Command npm.cmd).Source

$action = New-ScheduledTaskAction -Execute "cmd.exe" `
  -Argument "/c cd /d `"$project`" && `"$npm`" run meupluggy:renew >> .auth\renew.log 2>&1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) `
  -RepetitionInterval (New-TimeSpan -Hours 12)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "Tarefa criada: $name (a cada 12h). Log em $project\.auth\renew.log"
