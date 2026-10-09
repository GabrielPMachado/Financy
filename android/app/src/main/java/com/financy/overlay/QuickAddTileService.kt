package com.financy.overlay

import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.provider.Settings
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Ladrilho no painel de Configurações Rápidas (arrastar a barra de
 * notificações para baixo). Um toque nele abre o pop-up de lançamento
 * rápido por cima do que estiver na tela, sem precisar abrir o app.
 *
 * Depois de compilar, o usuário precisa adicionar o ladrilho manualmente
 * uma vez (é assim que o Android funciona para todo app: puxar o painel
 * duas vezes → "Editar" → arrastar o ícone do Financy para os ladrilhos
 * ativos). Não existe API para um app se auto-adicionar aos tiles ativos.
 */
class QuickAddTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        updateTileState()
    }

    override fun onClick() {
        super.onClick()
        if (!Settings.canDrawOverlays(this)) {
            // Sem a permissão de overlay ainda concedida: manda o usuário
            // pro app para conceder, já que a tela de permissão do sistema
            // não pode ser aberta diretamente por cima do Quick Settings
            // em todas as versões do Android.
            val openApp = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("open_overlay_permission_request", true)
            }
            openApp?.let { startActivityAndCollapse(it) }
            return
        }

        // Abre a activity-ponte (invisível) via startActivityAndCollapse,
        // que é a forma suportada de fechar o painel de Quick Settings
        // antes de ligar o serviço do overlay.
        val trampoline = Intent(this, OverlayTrampolineActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val pendingIntent = android.app.PendingIntent.getActivity(
                this, 0, trampoline,
                android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
            )
            startActivityAndCollapse(pendingIntent)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(trampoline)
        }
    }

    private fun updateTileState() {
        qsTile?.apply {
            label = "Lançamento rápido"
            icon = Icon.createWithResource(this@QuickAddTileService, android.R.drawable.ic_input_add)
            state = if (Settings.canDrawOverlays(this@QuickAddTileService))
                Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
            updateTile()
        }
    }
}
