package com.financy.overlay

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Lê/escreve as mesmas subcoleções do Firestore que o app web usa
 * (users/{uid}/despesas, /receitas, /investimentos, /cartoes, /categorias —
 * ver estrutura completa em src/lib/firebase.ts), usando a REST API direto,
 * sem depender do SDK completo do Firebase (mantém o overlay leve).
 *
 * Autenticação: o overlay não faz login sozinho. O app web (já logado)
 * empurra pra cá, via QuickAddOverlayPlugin.setAuthSession(), o uid e um ID
 * token do Firebase Auth — guardados em SharedPreferences. Esse token expira
 * em ~1h; o app web reenvia um novo sempre que o Firebase renova o dele
 * (onIdTokenChanged), então enquanto o app é aberto de vez em quando o token
 * aqui se mantém razoavelmente fresco.
 *
 * Modo online: toda leitura/escrita tenta ir direto pro Firestore com esse
 * token no header Authorization.
 * Modo offline (ou token ausente/expirado/sem internet): as LEITURAS caem
 * pra um cache local (que o app web mantém atualizado via
 * cacheCards/cacheCardsUsage/cacheCategories sempre que esses dados mudam),
 * e as ESCRITAS de transação novas ficam numa fila local
 * (getPendingTransactions/clearPendingTransactions) — o app web lê essa
 * fila e sincroniza pro Firestore na próxima vez que for aberto.
 */
object FirestoreSync {

    data class CategoryDto(val id: String, val name: String, val type: String, val color: String?)
    data class CardDto(val id: String, val name: String, val bank: String, val lastDigits: String)
    data class CardUsageDto(val id: String, val name: String, val bank: String, val lastDigits: String, val limit: Double, val used: Double)

    /** Mesmas categorias padrão de DEFAULT_TYPED_CATEGORIES (src/App.tsx), usadas como
     *  último fallback se não houver token válido nem nada em cache ainda. */
    val DEFAULT_CATEGORIES = listOf(
        CategoryDto("1", "Alimentação", "expense", "#F43F5E"),
        CategoryDto("2", "Moradia", "expense", "#E11D48"),
        CategoryDto("3", "Transporte", "expense", "#F97316"),
        CategoryDto("4", "Lazer", "expense", "#D97706"),
        CategoryDto("5", "Saúde", "expense", "#22C55E"),
        CategoryDto("6", "Educação", "expense", "#3B82F6"),
        CategoryDto("7", "Outras Despesas", "expense", "#64748B"),
        CategoryDto("8", "Salário", "income", "#10B981"),
        CategoryDto("9", "Freelance", "income", "#14B8A6"),
        CategoryDto("10", "Vendas", "income", "#06B6D4"),
        CategoryDto("11", "Rendimentos", "income", "#8B5CF6"),
        CategoryDto("12", "Outras Receitas", "income", "#64748B"),
        CategoryDto("13", "Ações", "investment", "#6366F1"),
        CategoryDto("14", "Fundos Imobiliários", "investment", "#8B5CF6"),
        CategoryDto("15", "Renda Fixa", "investment", "#A855F7"),
        CategoryDto("16", "Cripto", "investment", "#EC4899"),
        CategoryDto("17", "Reserva de Emergência", "investment", "#3B82F6"),
        CategoryDto("18", "Outros Investimentos", "investment", "#64748B"),
    )

    // Projeto Firebase atual do app (ver firebase-applet-config.json na raiz).
    // Banco padrão (sem nome próprio) -> "(default)" na URL da REST API.
    private const val PROJECT_ID = "financy-2d"
    private const val API_KEY = "AIzaSyDepvsTarS6FfS-nGNz51EVOlOR0yK5yOg"
    private const val TAG = "FinancyOverlay"
    private const val PREFS_NAME = "financy_overlay_prefs"

    private const val TRANSACTIONS_COLLECTION_EXPENSE = "despesas"
    private const val TRANSACTIONS_COLLECTION_INCOME = "receitas"
    private const val TRANSACTIONS_COLLECTION_INVESTMENT = "investimentos"
    private const val CARDS_COLLECTION = "cartoes"
    private const val CATEGORIES_COLLECTION = "categorias"

    private fun transactionCollectionFor(tipo: String): String = when (tipo) {
        "income" -> TRANSACTIONS_COLLECTION_INCOME
        "investment" -> TRANSACTIONS_COLLECTION_INVESTMENT
        else -> TRANSACTIONS_COLLECTION_EXPENSE
    }

    private fun documentsBaseUrl() =
        "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // ---------------------------------------------------------------------
    // Sessão de autenticação (recebida do app web via setAuthSession)
    // ---------------------------------------------------------------------

    fun saveAuthSession(context: Context, uid: String, idToken: String) {
        prefs(context).edit().putString("uid", uid).putString("idToken", idToken).apply()
    }

    fun clearAuthSession(context: Context) {
        prefs(context).edit().remove("uid").remove("idToken").apply()
    }

    private fun getUid(context: Context): String? = prefs(context).getString("uid", null)
    private fun getIdToken(context: Context): String? = prefs(context).getString("idToken", null)

    // ---------------------------------------------------------------------
    // Cache local (recebido do app web via cacheCards/cacheCardsUsage/cacheCategories)
    // ---------------------------------------------------------------------

    fun cacheCardsLocally(context: Context, cardsJson: String) {
        prefs(context).edit().putString("cachedCards", cardsJson).apply()
    }

    fun cacheCardsUsageLocally(context: Context, cardsUsageJson: String) {
        prefs(context).edit().putString("cachedCardsUsage", cardsUsageJson).apply()
    }

    fun cacheCategoriesLocally(context: Context, categoriesJson: String) {
        prefs(context).edit().putString("cachedCategories", categoriesJson).apply()
    }

    private fun readCachedCards(context: Context): List<CardDto> {
        val json = prefs(context).getString("cachedCards", null) ?: return emptyList()
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val id = o.optString("id", "")
                if (id.isBlank()) null
                else CardDto(id, o.optString("name", "Cartão"), o.optString("bank", ""), o.optString("lastDigits", "----"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao ler cache local de cartões", e)
            emptyList()
        }
    }

    private fun readCachedCardsUsage(context: Context): List<CardUsageDto> {
        val json = prefs(context).getString("cachedCardsUsage", null) ?: return emptyList()
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val id = o.optString("id", "")
                if (id.isBlank()) null
                else CardUsageDto(
                    id, o.optString("name", "Cartão"), o.optString("bank", ""), o.optString("lastDigits", "----"),
                    o.optDouble("limit", 0.0), o.optDouble("used", 0.0)
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao ler cache local de uso dos cartões", e)
            emptyList()
        }
    }

    private fun readCachedCategories(context: Context): List<CategoryDto> {
        val json = prefs(context).getString("cachedCategories", null) ?: return emptyList()
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).mapNotNull { i ->
                val o = arr.optJSONObject(i) ?: return@mapNotNull null
                val name = o.optString("name", "")
                if (name.isBlank()) null
                else CategoryDto(o.optString("id", "cat-$i"), name, o.optString("type", "expense"), o.optString("color", null))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao ler cache local de categorias", e)
            emptyList()
        }
    }

    // ---------------------------------------------------------------------
    // Fila de transações pendentes (quando salva offline / sem token válido)
    // ---------------------------------------------------------------------

    private fun addPendingTransaction(context: Context, txJson: JSONObject) {
        val p = prefs(context)
        val current = try { JSONArray(p.getString("pendingTransactions", "[]")) } catch (e: Exception) { JSONArray() }
        current.put(txJson)
        p.edit().putString("pendingTransactions", current.toString()).apply()
    }

    /** Devolve as transações pendentes de sincronizar, no mesmo formato que o app web espera. */
    fun getPendingTransactionsJson(context: Context): String {
        return prefs(context).getString("pendingTransactions", "[]") ?: "[]"
    }

    fun clearPendingTransactions(context: Context) {
        prefs(context).edit().remove("pendingTransactions").apply()
    }

    // ---------------------------------------------------------------------
    // Helpers HTTP
    // ---------------------------------------------------------------------

    /** Extrai o id do documento a partir do campo "name" retornado pelo Firestore
     *  (ex: ".../documents/users/abc/cartoes/XYZ123" -> "XYZ123"). */
    private fun docIdFromName(name: String?): String? = name?.substringAfterLast('/')?.takeIf { it.isNotBlank() }

    private fun openAuthedConnection(url: String, method: String, idToken: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.setRequestProperty("Authorization", "Bearer $idToken")
        conn.setRequestProperty("Content-Type", "application/json")
        return conn
    }

    /** GET de uma subcoleção inteira (users/{uid}/{collection}), autenticado.
     *  Devolve null se não houver sessão válida ou a chamada falhar. */
    private fun listCollection(context: Context, collection: String): JSONArray? {
        val uid = getUid(context) ?: return null
        val idToken = getIdToken(context) ?: return null
        return try {
            val url = "${documentsBaseUrl()}/users/$uid/$collection?key=$API_KEY&pageSize=300"
            val conn = openAuthedConnection(url, "GET", idToken)
            val code = conn.responseCode
            if (code !in 200..299) {
                Log.w(TAG, "listCollection($collection) falhou HTTP $code")
                conn.disconnect()
                return null
            }
            val text = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            JSONObject(text).optJSONArray("documents") ?: JSONArray()
        } catch (e: Exception) {
            Log.w(TAG, "listCollection($collection) erro de rede/parse", e)
            null
        }
    }

    // ---------------------------------------------------------------------
    // Categorias
    // ---------------------------------------------------------------------

    fun fetchCategories(context: Context, onResult: (categories: List<CategoryDto>) -> Unit) {
        val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
        Thread {
            val docs = listCollection(context, CATEGORIES_COLLECTION)
            if (docs != null) {
                val result = mutableListOf<CategoryDto>()
                for (i in 0 until docs.length()) {
                    val doc = docs.getJSONObject(i)
                    val id = docIdFromName(doc.optString("name")) ?: continue
                    val fields = doc.optJSONObject("fields") ?: continue
                    val name = fields.optJSONObject("name")?.optString("stringValue") ?: continue
                    val type = fields.optJSONObject("type")?.optString("stringValue") ?: "expense"
                    val color = fields.optJSONObject("color")?.optString("stringValue")
                    result.add(CategoryDto(id, name, type, color))
                }
                if (result.isNotEmpty()) {
                    cacheCategoriesLocally(context, categoriesToJson(result))
                    mainHandler.post { onResult(result) }
                    return@Thread
                }
            }
            // Sem token/sem internet/vazio -> cache local -> por último, padrão embutido.
            val cached = readCachedCategories(context)
            mainHandler.post { onResult(if (cached.isNotEmpty()) cached else DEFAULT_CATEGORIES) }
        }.start()
    }

    private fun categoriesToJson(list: List<CategoryDto>): String {
        val arr = JSONArray()
        list.forEach { c ->
            arr.put(JSONObject().apply {
                put("id", c.id); put("name", c.name); put("type", c.type); put("color", c.color ?: JSONObject.NULL)
            })
        }
        return arr.toString()
    }

    // ---------------------------------------------------------------------
    // Cartões
    // ---------------------------------------------------------------------

    fun fetchCards(context: Context, onResult: (cards: List<CardDto>) -> Unit) {
        val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
        Thread {
            val docs = listCollection(context, CARDS_COLLECTION)
            if (docs != null) {
                val result = mutableListOf<CardDto>()
                for (i in 0 until docs.length()) {
                    val doc = docs.getJSONObject(i)
                    val id = docIdFromName(doc.optString("name")) ?: continue
                    val fields = doc.optJSONObject("fields") ?: continue
                    val name = fields.optJSONObject("name")?.optString("stringValue") ?: "Cartão"
                    val bank = fields.optJSONObject("bank")?.optString("stringValue") ?: ""
                    val lastDigits = fields.optJSONObject("lastDigits")?.optString("stringValue") ?: "----"
                    result.add(CardDto(id, name, bank, lastDigits))
                }
                mainHandler.post { onResult(result) }
                return@Thread
            }
            mainHandler.post { onResult(readCachedCards(context)) }
        }.start()
    }

    /**
     * Busca cartões + uso do mês atual (soma das despesas do mês vinculadas a
     * cada cardId). onResult recebe (cards, erro):
     * - erro == null -> sucesso (seja direto do Firestore, seja do cache local).
     * - erro != null -> não tem sessão válida NEM nada em cache ainda (ex:
     *   nunca abriu o app principal depois de instalar) — motivo mostrado ao
     *   usuário, não escondido.
     */
    fun fetchCardsWithUsage(context: Context, onResult: (cards: List<CardUsageDto>, error: String?) -> Unit) {
        val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
        Thread {
            val cardDocs = listCollection(context, CARDS_COLLECTION)
            val despesaDocs = if (cardDocs != null) listCollection(context, TRANSACTIONS_COLLECTION_EXPENSE) else null

            if (cardDocs != null && despesaDocs != null) {
                val currentMonth = SimpleDateFormat("yyyy-MM", Locale.US).format(Date())
                val usedByCard = mutableMapOf<String, Double>()
                for (i in 0 until despesaDocs.length()) {
                    val fields = despesaDocs.getJSONObject(i).optJSONObject("fields") ?: continue
                    val date = fields.optJSONObject("date")?.optString("stringValue") ?: ""
                    val cardId = fields.optJSONObject("cardId")?.optString("stringValue")
                    if (cardId.isNullOrBlank() || !date.startsWith(currentMonth)) continue
                    val amount = parseFirestoreNumber(fields.optJSONObject("amount"))
                    usedByCard[cardId] = (usedByCard[cardId] ?: 0.0) + amount
                }

                val result = mutableListOf<CardUsageDto>()
                for (i in 0 until cardDocs.length()) {
                    val doc = cardDocs.getJSONObject(i)
                    val id = docIdFromName(doc.optString("name")) ?: continue
                    val fields = doc.optJSONObject("fields") ?: continue
                    val name = fields.optJSONObject("name")?.optString("stringValue") ?: "Cartão"
                    val bank = fields.optJSONObject("bank")?.optString("stringValue") ?: ""
                    val lastDigits = fields.optJSONObject("lastDigits")?.optString("stringValue") ?: "----"
                    val limit = parseFirestoreNumber(fields.optJSONObject("limit"))
                    result.add(CardUsageDto(id, name, bank, lastDigits, limit, usedByCard[id] ?: 0.0))
                }
                mainHandler.post { onResult(result, null) }
                return@Thread
            }

            // Sem internet, sem token válido, ou request falhou -> cache local.
            val cached = readCachedCardsUsage(context)
            if (cached.isNotEmpty() || getUidHasEverLoggedIn(context)) {
                mainHandler.post { onResult(cached, null) }
            } else {
                mainHandler.post {
                    onResult(emptyList(), "Abra o app principal pelo menos uma vez (com internet) antes de usar o pop-up.")
                }
            }
        }.start()
    }

    private fun getUidHasEverLoggedIn(context: Context): Boolean = getUid(context) != null

    /** Lê um valor numérico do Firestore REST, aceitando doubleValue ou integerValue. */
    private fun parseFirestoreNumber(valueObj: JSONObject?): Double {
        if (valueObj == null) return 0.0
        if (valueObj.has("doubleValue")) return valueObj.optDouble("doubleValue", 0.0)
        if (valueObj.has("integerValue")) return valueObj.optString("integerValue", "0").toDoubleOrNull() ?: 0.0
        return 0.0
    }

    // ---------------------------------------------------------------------
    // Nova transação
    // ---------------------------------------------------------------------

    fun appendTransaction(
        context: Context,
        tipo: String,
        valor: String,
        categoria: String,
        descricao: String,
        dataIso: String? = null,
        cardId: String? = null,
        onResult: ((success: Boolean, message: String) -> Unit)? = null
    ) {
        val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
        fun notify(success: Boolean, message: String) {
            Log.i(TAG, message)
            onResult?.let { cb -> mainHandler.post { cb(success, message) } }
        }

        Thread {
            val amount = valor.replace(",", ".").toDoubleOrNull() ?: 0.0
            val isoDate = dataIso ?: SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = TimeZone.getDefault()
            }.format(Date())
            val txId = UUID.randomUUID().toString()

            val uid = getUid(context)
            val idToken = getIdToken(context)

            if (uid != null && idToken != null) {
                try {
                    val collection = transactionCollectionFor(tipo)
                    val fields = JSONObject().apply {
                        put("description", JSONObject().put("stringValue", descricao))
                        put("amount", JSONObject().put("doubleValue", amount))
                        put("category", JSONObject().put("stringValue", categoria))
                        put("date", JSONObject().put("stringValue", isoDate))
                        if (!cardId.isNullOrBlank()) {
                            put("cardId", JSONObject().put("stringValue", cardId))
                        }
                    }
                    val body = JSONObject().put("fields", fields)
                    val url = "${documentsBaseUrl()}/users/$uid/$collection?documentId=$txId&key=$API_KEY"
                    val conn = openAuthedConnection(url, "POST", idToken)
                    conn.doOutput = true
                    conn.outputStream.use { it.write(body.toString().toByteArray()) }
                    val code = conn.responseCode
                    if (code in 200..299) {
                        conn.disconnect()
                        notify(true, "Transação salva no banco de dados.")
                        return@Thread
                    }
                    val err = conn.errorStream?.bufferedReader()?.readText()
                    Log.w(TAG, "Falha ao salvar direto (HTTP $code): $err — caindo pra fila local.")
                    conn.disconnect()
                } catch (e: Exception) {
                    Log.w(TAG, "Erro de rede ao salvar direto — caindo pra fila local.", e)
                }
            }

            // Offline, sem sessão, ou a chamada online falhou: guarda localmente.
            // O app web sincroniza isso na próxima vez que for aberto (ver
            // getPendingTransactions/clearPendingTransactions).
            val pendingTx = JSONObject().apply {
                put("id", "overlay-$txId")
                put("description", descricao)
                put("amount", amount)
                put("type", tipo)
                put("category", categoria)
                put("date", isoDate)
                if (!cardId.isNullOrBlank()) put("cardId", cardId)
            }
            addPendingTransaction(context, pendingTx)
            notify(true, "Sem conexão no momento — salvo no celular. Sincroniza sozinho quando você abrir o app.")
        }.start()
    }
}
