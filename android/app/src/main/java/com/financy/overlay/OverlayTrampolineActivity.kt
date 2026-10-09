package com.financy.overlay

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle

/**
 * Activity invisível: existe só para permitir que o TileService feche o
 * painel de Configurações Rápidas de forma suportada (via
 * startActivityAndCollapse) antes de ligar o OverlayService. Ela mesma
 * nunca desenha nada na tela — abre e fecha na hora.
 *
 * Precisa estar declarada no AndroidManifest.xml com tema transparente
 * (ver AndroidManifest-additions.xml).
 */
class OverlayTrampolineActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val intent = Intent(this, OverlayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        finish()
        overridePendingTransition(0, 0)
    }
}
