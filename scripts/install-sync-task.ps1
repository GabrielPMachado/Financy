<#
 Cria no Windows a tarefa "Financy - Disparar sincronizacao": roda
 `npm run sync:dispatch` de hora em hora, o que dispara o workflow no GitHub Actions
 (que atualiza o Mercado Pago, e o Nubank às 06h e 18h). Complementa o agendamento do
 GitHub, que costuma atrasar e pular horários. Só funciona com o PC ligado; não usa o
 Claude nem gasta tokens. Se o PC estava desligado no horário, roda assim que ligar.
 Para remover:
   Unregister-ScheduledTask -TaskName "Financy - Disparar sincronizacao" -Confirm:$false
#>
$project = Split-Path -Parent $PSScriptRoot
$name = "Financy - Disparar sincronizacao"
$npm = (Get-Command npm.cmd).Source

$action = New-ScheduledTaskAction -Execute "cmd.exe" `
  -Argument "/c cd /d `"$project`" && if not exist .auth mkdir .auth && `"$npm`" run sync:dispatch >> .auth\dispatch.log 2>&1"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
  -RepetitionInterval (New-TimeSpan -Hours 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "Tarefa criada: $name (de hora em hora). Log em $project\.auth\dispatch.log"
