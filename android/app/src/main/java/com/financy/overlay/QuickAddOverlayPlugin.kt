package com.financy.overlay

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Ponte JS <-> Android nativo. No React, chame via:
 *   import { QuickAddOverlay } from './native/quickAddOverlay';
 *   await QuickAddOverlay.requestOverlayPermission();
 *   await QuickAddOverlay.startQuickAdd();
 */
@CapacitorPlugin(name = "QuickAddOverlay")
class QuickAddOverlayPlugin : Plugin() {

    @PluginMethod
    fun hasOverlayPermission(call: PluginCall) {
        val granted = Settings.canDrawOverlays(context)
        val result = JSObject()
        result.put("granted", granted)
        call.resolve(result)
    }

    @PluginMethod
    fun requestOverlayPermission(call: PluginCall) {
        if (Settings.canDrawOverlays(context)) {
            val result = JSObject()
            result.put("granted", true)
            call.resolve(result)
            return
        }
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}")
        )
        // O usuário concede manualmente na tela do sistema; o app não
        // recebe callback direto, então o lado JS deve checar
        // hasOverlayPermission() de novo quando o app voltar ao foreground
        // (ex: no evento 'appStateChange' do Capacitor).
        activity.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun startQuickAdd(call: PluginCall) {
        if (!Settings.canDrawOverlays(context)) {
            call.reject("Permissão 'Exibir sobre outros aplicativos' não concedida.")
            return
        }
        val intent = Intent(context, OverlayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun stopQuickAdd(call: PluginCall) {
        val intent = Intent(context, OverlayService::class.java).apply {
            action = OverlayService.ACTION_STOP
        }
        context.startService(intent)
        call.resolve()
    }

    // -----------------------------------------------------------------
    // Ponte de dados com o app web: sessão de login, cache offline e fila
    // de transações pendentes de sincronizar. Ver FirestoreSync.kt.
    // -----------------------------------------------------------------

    /** Chamado pelo app web logo após login e sempre que o ID token do
     *  Firebase é renovado (onIdTokenChanged), pra o overlay conseguir
     *  ler/escrever direto no Firestore quando há internet. */
    @PluginMethod
    fun setAuthSession(call: PluginCall) {
        val uid = call.getString("uid")
        val idToken = call.getString("idToken")
        if (uid.isNullOrBlank() || idToken.isNullOrBlank()) {
            call.reject("uid e idToken são obrigatórios")
            return
        }
        FirestoreSync.saveAuthSession(context, uid, idToken)
        call.resolve()
    }

    /** Chamado pelo app web no logout. */
    @PluginMethod
    fun clearAuthSession(call: PluginCall) {
        FirestoreSync.clearAuthSession(context)
        call.resolve()
    }

    /** Cache local dos cartões cadastrados (lista simples, pra popular o
     *  seletor de cartão do pop-up mesmo offline). */
    @PluginMethod
    fun cacheCards(call: PluginCall) {
        val json = call.getString("cardsJson") ?: "[]"
        FirestoreSync.cacheCardsLocally(context, json)
        call.resolve()
    }

    /** Cache local dos cartões já com o "limite usado" do mês calculado
     *  (mesma lógica do CreditCardEdgePanel), pra tela "Meus Cartões"
     *  funcionar offline. */
    @PluginMethod
    fun cacheCardsUsage(call: PluginCall) {
        val json = call.getString("cardsUsageJson") ?: "[]"
        FirestoreSync.cacheCardsUsageLocally(context, json)
        call.resolve()
    }

    /** Cache local das categorias cadastradas. */
    @PluginMethod
    fun cacheCategories(call: PluginCall) {
        val json = call.getString("categoriesJson") ?: "[]"
        FirestoreSync.cacheCategoriesLocally(context, json)
        call.resolve()
    }

    /** Devolve as transações criadas pelo overlay enquanto offline (ou sem
     *  sessão válida), ainda não sincronizadas — o app web lê isso ao abrir,
     *  grava no Firestore normalmente e chama clearPendingTransactions(). */
    @PluginMethod
    fun getPendingTransactions(call: PluginCall) {
        val json = FirestoreSync.getPendingTransactionsJson(context)
        val result = JSObject()
        result.put("transactionsJson", json)
        call.resolve(result)
    }

    @PluginMethod
    fun clearPendingTransactions(call: PluginCall) {
        FirestoreSync.clearPendingTransactions(context)
        call.resolve()
    }
}
