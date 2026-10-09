package com.financy.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Service em primeiro plano responsável por desenhar o pop-up de
 * "lançamento rápido" sobre qualquer outro aplicativo (overlay do sistema).
 *
 * Visual espelha o TransactionModal.tsx do app web: card "vidro fosco"
 * (fundo escuro semitransparente + borda esmeralda), badge "Pop-up Rápido",
 * cards de tipo com ícone/seta, barra de progresso por etapa.
 *
 * Obs: não existe blur real do que está atrás da janela (isso exigiria
 * MediaProjection / captura de tela de outros apps). O efeito aqui é
 * "vidro fosco" — fundo semitransparente, sem desfoque pixel a pixel.
 */
class OverlayService : Service() {

    private fun todayIsoStatic(): String = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        .format(java.util.Date())
    private fun yesterdayIsoStatic(): String {
        val cal = java.util.Calendar.getInstance()
        cal.add(java.util.Calendar.DAY_OF_YEAR, -1)
        return java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(cal.time)
    }

    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null

    private var step = Step.TIPO
    private var tipo: String = "expense"
    private var valor: String = ""
    private var categoria: String = ""
    private var descricao: String = ""
    private var dataEscolhida: String = todayIsoStatic()
    private var cardIdEscolhido: String? = null

    private enum class Step {
        TIPO, VALOR, CATEGORIA, CATEGORIA_MANUAL, CARTAO, DATA, DESCRICAO, CONFIRMAR, SALVANDO, RESULTADO,
        CARTOES_LISTA, PAGAR_FATURA
    }
    private var resultadoSucesso = true
    private var resultadoMensagem = ""
    private var resultadoEhPagamentoFatura = false
    private var categoriasCache: List<FirestoreSync.CategoryDto>? = null
    private var categoriasCarregando = false
    private var cartoesCache: List<FirestoreSync.CardDto>? = null
    private var cartoesCarregando = false
    private var cartoesUsoCache: List<FirestoreSync.CardUsageDto>? = null
    private var cartoesUsoCarregando = false
    private var cartoesUsoErro: String? = null
    private var pagamentoCardId: String? = null
    private var pagamentoCardName: String = ""
    private var pagamentoValor: String = ""
    private var pagamentoData: String = todayIsoStatic()

    // Paleta igual à do app web (ver src/index.css e TransactionModal.tsx)
    private val colorCardGlass = Color.parseColor("#D90F172A")  // slate-900 ~85% opaco
    private val colorBorder = Color.parseColor("#6610B981")     // emerald-500 ~40% opaco
    private val colorAccent = Color.parseColor("#10B981")
    private val colorAccentSoft = Color.parseColor("#2610B981") // emerald-500 ~15%
    private val colorText = Color.WHITE
    private val colorMuted = Color.parseColor("#94A3B8")
    private val colorDanger = Color.parseColor("#EF4444")
    private val colorDangerSoft = Color.parseColor("#33450A14")
    private val colorDangerBorder = Color.parseColor("#80EF4444")
    private val colorIncomeSoft = Color.parseColor("#3305230F")
    private val colorIncomeBorder = Color.parseColor("#8010B981")
    private val colorInvestment = Color.parseColor("#3B82F6")
    private val colorInvestmentSoft = Color.parseColor("#33172554")
    private val colorInvestmentBorder = Color.parseColor("#803B82F6")
    private val colorTrackBg = Color.parseColor("#4D000000")
    private val colorFieldBg = Color.parseColor("#99020617")
    private val colorFieldBorder = Color.parseColor("#803B4155")
    private val colorSecondaryBg = Color.parseColor("#B31E293B")

    companion object {
        const val CHANNEL_ID = "financy_overlay_channel"
        const val NOTIFICATION_ID = 4821
        const val ACTION_STOP = "com.financy.overlay.action.STOP"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopOverlay()
            return START_NOT_STICKY
        }
        startForegroundWithNotification()
        if (overlayView == null) {
            windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
            step = Step.TIPO
            tipo = "expense"; valor = ""; categoria = ""; descricao = ""; dataEscolhida = todayIsoStatic()
            cardIdEscolhido = null
            cartoesUsoErro = null
            if (categoriasCache == null && !categoriasCarregando) {
                categoriasCarregando = true
                FirestoreSync.fetchCategories(this) { cats ->
                    categoriasCache = cats
                    categoriasCarregando = false
                    if (step == Step.CATEGORIA) showStep() // já estava esperando nessa tela
                }
            }
            if (cartoesCache == null && !cartoesCarregando) {
                cartoesCarregando = true
                FirestoreSync.fetchCards(this) { cartoes ->
                    cartoesCache = cartoes
                    cartoesCarregando = false
                    if (step == Step.CARTAO) showStep()
                }
            }
            showStep()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        removeOverlayView()
        super.onDestroy()
    }

    private fun dp(value: Int): Int = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics
    ).toInt()

    // ---------------------------------------------------------------
    // Notificação obrigatória para rodar como Foreground Service
    // ---------------------------------------------------------------
    private fun startForegroundWithNotification() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Lançamento rápido (overlay)", NotificationManager.IMPORTANCE_MIN
            )
            manager.createNotificationChannel(channel)
        }

        val stopIntent = Intent(this, OverlayService::class.java).apply { action = ACTION_STOP }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification: Notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Financy — lançamento rápido ativo")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .addAction(0, "Fechar", stopPendingIntent)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    // ---------------------------------------------------------------
    // Janela flutuante
    // ---------------------------------------------------------------
    private fun overlayLayoutParams(): WindowManager.LayoutParams {
        val overlayType =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        return WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.CENTER }
    }

    private fun removeOverlayView() {
        overlayView?.let { runCatching { windowManager.removeView(it) } }
        overlayView = null
    }

    // ---------------------------------------------------------------
    // Helpers visuais
    // ---------------------------------------------------------------
    private fun roundedBg(color: Int, radiusDp: Int = 20, strokeColor: Int? = null, strokeDp: Int = 1) =
        GradientDrawable().apply {
            setColor(color)
            cornerRadius = dp(radiusDp).toFloat()
            strokeColor?.let { setStroke(dp(strokeDp), it) }
        }

    /** Bolha decorativa borrada (glow), igual aos "accents" do modal web. Blur real via RenderEffect (API 31+). */
    private fun glowOrb(color: Int, sizeDp: Int): View {
        val orb = View(this).apply {
            layoutParams = FrameLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(color)
            }
            alpha = 0.5f
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            orb.setRenderEffect(
                android.graphics.RenderEffect.createBlurEffect(dp(30).toFloat(), dp(30).toFloat(), Shader.TileMode.CLAMP)
            )
        }
        return orb
    }

    private fun outerWrapper(cardWithGlow: View): LinearLayout {
        val wrapper = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(48), dp(20), dp(48))
            setBackgroundColor(Color.TRANSPARENT)
        }
        wrapper.addView(cardWithGlow)
        return wrapper
    }

    /** Badge "Pop-up Rápido" igual ao header do modal web. */
    private fun headerBadge(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = roundedBg(colorAccentSoft, radiusDp = 20, strokeColor = Color.parseColor("#4D10B981"))
            setPadding(dp(12), dp(5), dp(12), dp(5))
            val dot = View(this@OverlayService).apply {
                layoutParams = LinearLayout.LayoutParams(dp(6), dp(6)).apply { marginEnd = dp(6) }
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(colorAccent) }
            }
            addView(dot)
            addView(TextView(this@OverlayService).apply {
                text = "Pop-up Rápido"
                setTextColor(colorAccent)
                textSize = 11f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            })
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = dp(16)
            layoutParams = lp
        }
    }

    /** Barra "Etapa X de 6" com progresso, igual ao modal web. */
    private fun progressHeader(stepIndex: Int): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = dp(18)
            layoutParams = lp
        }
        val labels = arrayOf("Escolha o Tipo", "Informe o Valor", "Categoria", "Data", "Descrição", "Confirmar")
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(6) }
        }
        row.addView(TextView(this).apply {
            text = "Etapa ${stepIndex + 1} de 6"
            setTextColor(colorMuted)
            textSize = 12f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        row.addView(TextView(this).apply {
            text = labels[stepIndex]
            setTextColor(colorAccent)
            textSize = 12f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        container.addView(row)

        val track = FrameLayout(this).apply {
            background = roundedBg(colorTrackBg, radiusDp = 8)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(6))
        }
        val fill = View(this).apply {
            background = roundedBg(colorAccent, radiusDp = 8)
            layoutParams = FrameLayout.LayoutParams(0, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        track.addView(fill)
        track.post {
            val w = (track.width * ((stepIndex + 1) / 6f)).toInt()
            fill.layoutParams = FrameLayout.LayoutParams(w, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        container.addView(track)
        return container
    }

    private fun sectionTitle(text: String, subtitle: String? = null): LinearLayout {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = dp(16)
            layoutParams = lp
        }
        col.addView(TextView(this).apply {
            this.text = text
            setTextColor(colorText)
            textSize = 17f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        if (subtitle != null) {
            col.addView(TextView(this).apply {
                this.text = subtitle
                setTextColor(colorMuted)
                textSize = 12f
                val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                lp.topMargin = dp(2)
                layoutParams = lp
            })
        }
        return col
    }

    /** Card de tipo (Despesa/Receita/Investimento): ícone + título + descrição + seta — igual ao modal web. */
    private fun typeOptionRow(emoji: String, title: String, desc: String, softBg: Int, border: Int, onClick: () -> Unit): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = roundedBg(softBg, radiusDp = 16, strokeColor = border)
            setPadding(dp(14), dp(14), dp(14), dp(14))
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = dp(10)
            layoutParams = lp
            isClickable = true
            isFocusable = true

            addView(TextView(this@OverlayService).apply {
                text = emoji
                textSize = 20f
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(dp(40), dp(40)).apply { marginEnd = dp(12) }
                background = roundedBg(border, radiusDp = 12)
            })

            val col = LinearLayout(this@OverlayService).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            col.addView(TextView(this@OverlayService).apply {
                text = title
                setTextColor(colorText)
                textSize = 14f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            })
            col.addView(TextView(this@OverlayService).apply {
                text = desc
                setTextColor(colorMuted)
                textSize = 11f
            })
            addView(col)

            addView(TextView(this@OverlayService).apply {
                text = "→"
                setTextColor(colorMuted)
                textSize = 16f
            })

            setOnClickListener { onClick() }
        }
    }

    private fun styledEditText(hintText: String, numeric: Boolean = false): EditText {
        return EditText(this).apply {
            hint = hintText
            setHintTextColor(colorMuted)
            setTextColor(colorText)
            textSize = 20f
            gravity = Gravity.CENTER
            if (numeric) inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            setPadding(dp(16), dp(18), dp(16), dp(18))
            background = roundedBg(colorFieldBg, radiusDp = 16, strokeColor = colorFieldBorder)
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = dp(16)
            layoutParams = lp
            requestFocus()
        }
    }

    private fun primaryButton(text: String, color: Int = colorAccent, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(Color.WHITE)
        textSize = 15f
        background = roundedBg(color, radiusDp = 14)
        setPadding(dp(20), dp(14), dp(20), dp(14))
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        lp.bottomMargin = dp(10)
        layoutParams = lp
        setOnClickListener { onClick() }
        stateListAnimator = null
    }

    private fun secondaryButton(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setTextColor(colorMuted)
        textSize = 13f
        background = roundedBg(colorSecondaryBg, radiusDp = 14, strokeColor = colorFieldBorder)
        setPadding(dp(20), dp(12), dp(20), dp(12))
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        lp.bottomMargin = dp(10)
        layoutParams = lp
        setOnClickListener { onClick() }
        stateListAnimator = null
    }

    /** Monta o card "vidro fosco" com brilhos decorativos, igual ao modal do app web. */
    private fun buildGlassCard(inner: View): FrameLayout {
        val frame = FrameLayout(this)

        // Brilhos decorativos (glow accents), como no modal web
        frame.addView(glowOrb(colorAccent, 140).apply {
            layoutParams = FrameLayout.LayoutParams(dp(140), dp(140), Gravity.TOP or Gravity.END).apply {
                topMargin = -dp(40); rightMargin = -dp(40)
            }
        })
        frame.addView(glowOrb(colorInvestment, 140).apply {
            layoutParams = FrameLayout.LayoutParams(dp(140), dp(140), Gravity.BOTTOM or Gravity.START).apply {
                bottomMargin = -dp(40); leftMargin = -dp(40)
            }
        })

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(20))
            background = roundedBg(colorCardGlass, radiusDp = 26, strokeColor = colorBorder)
            elevation = dp(16).toFloat()
            clipToOutline = true
        }
        card.addView(inner)
        frame.addView(card)
        return frame
    }

    /** Monta programaticamente o conteúdo do passo atual e (re)desenha o overlay. */
    private fun showStep() {
        removeOverlayView()

        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        val stepIndex = when (step) {
            Step.TIPO -> 0; Step.VALOR -> 1; Step.CATEGORIA -> 2; Step.CATEGORIA_MANUAL -> 2; Step.CARTAO -> 2
            Step.DATA -> 3; Step.DESCRICAO -> 4; Step.CONFIRMAR -> 5
            Step.SALVANDO -> 5; Step.RESULTADO -> 5
            Step.CARTOES_LISTA -> 0; Step.PAGAR_FATURA -> 0
        }
        val mostraProgresso = step != Step.SALVANDO && step != Step.RESULTADO &&
            step != Step.CARTOES_LISTA && step != Step.PAGAR_FATURA
        content.addView(headerBadge())
        if (mostraProgresso) content.addView(progressHeader(stepIndex))

        when (step) {
            Step.TIPO -> {
                content.addView(sectionTitle("Qual é o tipo da transação?", "Selecione para organizar seu lançamento."))
                content.addView(typeOptionRow("💸", "Despesa", "Gastos, compras, contas a pagar", colorDangerSoft, colorDangerBorder) {
                    tipo = "expense"; step = Step.VALOR; showStep()
                })
                content.addView(typeOptionRow("💰", "Receita", "Salário, vendas, entradas de dinheiro", colorIncomeSoft, colorIncomeBorder) {
                    tipo = "income"; step = Step.VALOR; showStep()
                })
                content.addView(typeOptionRow("📈", "Investimento", "Aportes, reservas, ações, renda fixa", colorInvestmentSoft, colorInvestmentBorder) {
                    tipo = "investment"; step = Step.VALOR; showStep()
                })
                content.addView(secondaryButton("💳  Ver Cartões") {
                    step = Step.CARTOES_LISTA
                    showStep()
                    if (!cartoesUsoCarregando) {
                        cartoesUsoCarregando = true
                        FirestoreSync.fetchCardsWithUsage(this) { lista, erro ->
                            cartoesUsoCache = lista
                            cartoesUsoErro = erro
                            cartoesUsoCarregando = false
                            if (step == Step.CARTOES_LISTA) showStep()
                        }
                    }
                })
                content.addView(secondaryButton("Cancelar") { stopSelf() })
            }

            Step.VALOR -> {
                content.addView(sectionTitle("Qual é o valor?", "Digite a quantia em reais."))
                val input = styledEditText("R$ 0,00", numeric = true)
                content.addView(input)
                content.addView(primaryButton("Avançar") {
                    valor = input.text.toString()
                    if (valor.isNotBlank()) { step = Step.CATEGORIA; showStep() }
                })
                content.addView(secondaryButton("Voltar") { step = Step.TIPO; showStep() })
            }

            Step.CATEGORIA -> {
                content.addView(sectionTitle("Categoria", "Selecione uma categoria de ${labelForTipo(tipo).substringAfter(' ')}."))

                val cats = categoriasCache
                if (cats == null) {
                    content.addView(TextView(this).apply {
                        text = "Carregando categorias…"
                        setTextColor(colorMuted)
                        textSize = 13f
                        gravity = Gravity.CENTER
                        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                        lp.bottomMargin = dp(12)
                        layoutParams = lp
                    })
                } else {
                    val filtradas = cats.filter { it.type == tipo }
                    val listaScroll = android.widget.ScrollView(this).apply {
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT, dp(280)
                        ).apply { bottomMargin = dp(12) }
                        isFillViewport = false
                    }
                    val listaContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                    if (filtradas.isEmpty()) {
                        listaContainer.addView(TextView(this@OverlayService).apply {
                            text = "Nenhuma categoria salva ainda para esse tipo."
                            setTextColor(colorMuted)
                            textSize = 12f
                            gravity = Gravity.CENTER
                        })
                    }
                    filtradas.forEach { cat ->
                        listaContainer.addView(categoryPill(cat) {
                            categoria = cat.name
                            step = proximoPassoAposCategoria()
                            showStep()
                        })
                    }
                    listaScroll.addView(listaContainer)
                    content.addView(listaScroll)
                }

                content.addView(secondaryButton("+ Outra categoria") { step = Step.CATEGORIA_MANUAL; showStep() })
                content.addView(secondaryButton("Voltar") { step = Step.VALOR; showStep() })
            }

            Step.CATEGORIA_MANUAL -> {
                content.addView(sectionTitle("Nova categoria"))
                val input = styledEditText("Digite o nome da categoria")
                content.addView(input)
                content.addView(primaryButton("Avançar") {
                    categoria = input.text.toString()
                    if (categoria.isNotBlank()) { step = proximoPassoAposCategoria(); showStep() }
                })
                content.addView(secondaryButton("Voltar") { step = Step.CATEGORIA; showStep() })
            }

            Step.CARTAO -> {
                content.addView(sectionTitle("Vincular a um cartão?", "Opcional — ajuda a contabilizar o limite."))

                val listaScroll = android.widget.ScrollView(this).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, dp(240)
                    ).apply { bottomMargin = dp(12) }
                }
                val listaContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

                listaContainer.addView(cardPill("Nenhum cartão", null, cardIdEscolhido == null) {
                    cardIdEscolhido = null
                    step = Step.DATA
                    showStep()
                })
                cartoesCache?.forEach { c ->
                    listaContainer.addView(cardPill("${c.name} — ${c.bank} •••• ${c.lastDigits}", c.id, cardIdEscolhido == c.id) {
                        cardIdEscolhido = c.id
                        step = Step.DATA
                        showStep()
                    })
                }
                listaScroll.addView(listaContainer)
                content.addView(listaScroll)

                content.addView(secondaryButton("Voltar") { step = Step.CATEGORIA; showStep() })
            }

            Step.DATA -> {
                content.addView(sectionTitle("Qual é a data?", "Escolha rapidamente ou digite outra."))

                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    lp.bottomMargin = dp(12)
                    layoutParams = lp
                }
                row.addView(dateQuickButton("Hoje", todayIsoStatic(), dataEscolhida) { dataEscolhida = todayIsoStatic(); showStep() }.apply {
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = dp(6) }
                })
                row.addView(dateQuickButton("Ontem", yesterdayIsoStatic(), dataEscolhida) { dataEscolhida = yesterdayIsoStatic(); showStep() }.apply {
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = dp(6) }
                })
                content.addView(row)

                content.addView(TextView(this).apply {
                    text = "Ou digite outra data (DD/MM/AAAA)"
                    setTextColor(colorMuted)
                    textSize = 11f
                    val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    lp.bottomMargin = dp(6)
                    layoutParams = lp
                })
                val customInput = styledEditText("DD/MM/AAAA").apply {
                    setText(formatIsoToBr(dataEscolhida))
                }
                content.addView(customInput)

                content.addView(primaryButton("Avançar") {
                    val parsed = parseBrToIso(customInput.text.toString())
                    if (parsed != null) dataEscolhida = parsed
                    step = Step.DESCRICAO
                    showStep()
                })
                content.addView(secondaryButton("Voltar") {
                    step = if (temCartoesParaEscolher()) Step.CARTAO else Step.CATEGORIA
                    showStep()
                })
            }

            Step.DESCRICAO -> {
                content.addView(sectionTitle("Descrição (opcional)"))
                val input = styledEditText("Ex: Almoço com a equipe")
                content.addView(input)
                content.addView(primaryButton("Avançar") {
                    descricao = input.text.toString()
                    step = Step.CONFIRMAR; showStep()
                })
                content.addView(secondaryButton("Voltar") { step = Step.DATA; showStep() })
            }

            Step.CONFIRMAR -> {
                content.addView(sectionTitle("Confirmar lançamento"))
                val cartaoSelecionado = cartoesCache?.find { it.id == cardIdEscolhido }
                val resumo = TextView(this).apply {
                    text = "${labelForTipo(tipo)}\nR$ $valor  •  $categoria\n${formatIsoToBr(dataEscolhida)}" +
                        (if (descricao.isNotBlank()) "\n$descricao" else "") +
                        (if (cartaoSelecionado != null) "\n💳 ${cartaoSelecionado.name} •••• ${cartaoSelecionado.lastDigits}" else "")
                    setTextColor(colorMuted)
                    textSize = 14f
                    gravity = Gravity.CENTER
                    val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    lp.bottomMargin = dp(18)
                    layoutParams = lp
                }
                content.addView(resumo)
                content.addView(primaryButton("Salvar") {
                    step = Step.SALVANDO
                    resultadoEhPagamentoFatura = false
                    showStep()
                    FirestoreSync.appendTransaction(
                        context = this@OverlayService,
                        tipo = tipo, valor = valor, categoria = categoria, descricao = descricao,
                        dataIso = dataEscolhida, cardId = cardIdEscolhido
                    ) { success, message ->
                        resultadoSucesso = success
                        resultadoMensagem = message
                        step = Step.RESULTADO
                        showStep()
                    }
                })
                content.addView(secondaryButton("Cancelar") { stopSelf() })
            }

            Step.CARTOES_LISTA -> {
                content.addView(sectionTitle("Meus Cartões", "Uso do mês atual por cartão."))

                val lista = cartoesUsoCache
                val erro = cartoesUsoErro
                if (cartoesUsoCarregando || (lista == null && erro == null)) {
                    content.addView(TextView(this).apply {
                        text = "Carregando cartões…"
                        setTextColor(colorMuted)
                        textSize = 13f
                        gravity = Gravity.CENTER
                    })
                } else if (erro != null) {
                    content.addView(TextView(this).apply {
                        text = "⚠️ Não foi possível carregar os cartões.\n$erro"
                        setTextColor(colorDanger)
                        textSize = 12f
                        gravity = Gravity.CENTER
                        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                        lp.bottomMargin = dp(12)
                        layoutParams = lp
                    })
                    content.addView(primaryButton("Tentar de novo") {
                        cartoesUsoCarregando = true
                        showStep()
                        FirestoreSync.fetchCardsWithUsage(this) { novaLista, novoErro ->
                            cartoesUsoCache = novaLista
                            cartoesUsoErro = novoErro
                            cartoesUsoCarregando = false
                            if (step == Step.CARTOES_LISTA) showStep()
                        }
                    })
                } else if (lista != null && lista.isEmpty()) {
                    content.addView(TextView(this).apply {
                        text = "Nenhum cartão cadastrado ainda.\nCadastre um no app principal."
                        setTextColor(colorMuted)
                        textSize = 12f
                        gravity = Gravity.CENTER
                        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                        lp.bottomMargin = dp(12)
                        layoutParams = lp
                    })
                } else if (lista != null) {
                    val scroll = android.widget.ScrollView(this).apply {
                        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(320))
                            .apply { bottomMargin = dp(12) }
                    }
                    val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                    lista.forEach { c -> col.addView(cardUsageCard(c)) }
                    scroll.addView(col)
                    content.addView(scroll)
                }

                content.addView(secondaryButton("Voltar") { step = Step.TIPO; showStep() })
            }

            Step.PAGAR_FATURA -> {
                content.addView(sectionTitle("Pagar Fatura", pagamentoCardName))

                content.addView(TextView(this).apply {
                    text = "Valor a pagar"
                    setTextColor(colorMuted)
                    textSize = 11f
                    val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    lp.bottomMargin = dp(4)
                    layoutParams = lp
                })
                val valorInput = styledEditText("R$ 0,00", numeric = true).apply {
                    setText(pagamentoValor)
                }
                content.addView(valorInput)

                val rowData = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    lp.bottomMargin = dp(12)
                    layoutParams = lp
                }
                rowData.addView(dateQuickButton("Hoje", todayIsoStatic(), pagamentoData) {
                    pagamentoData = todayIsoStatic(); showStep()
                }.apply {
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = dp(6) }
                })
                rowData.addView(dateQuickButton("Ontem", yesterdayIsoStatic(), pagamentoData) {
                    pagamentoData = yesterdayIsoStatic(); showStep()
                }.apply {
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = dp(6) }
                })
                content.addView(rowData)

                content.addView(primaryButton("Confirmar Pagamento") {
                    pagamentoValor = valorInput.text.toString()
                    val amount = pagamentoValor.replace(",", ".").toDoubleOrNull() ?: 0.0
                    if (amount > 0) {
                        step = Step.SALVANDO
                        resultadoEhPagamentoFatura = true
                        showStep()
                        FirestoreSync.appendTransaction(
                            context = this@OverlayService,
                            tipo = "expense",
                            valor = pagamentoValor,
                            categoria = "Pagamento de Fatura",
                            descricao = "Pagamento fatura - $pagamentoCardName",
                            dataIso = pagamentoData,
                            cardId = null
                        ) { success, message ->
                            resultadoSucesso = success
                            resultadoMensagem = message
                            step = Step.RESULTADO
                            cartoesUsoCache = null // força recarregar limite usado da próxima vez
                            showStep()
                        }
                    }
                })
                content.addView(secondaryButton("Voltar") { step = Step.CARTOES_LISTA; showStep() })
            }

            Step.SALVANDO -> {
                content.addView(TextView(this).apply {
                    text = "Salvando…"
                    setTextColor(colorMuted)
                    textSize = 15f
                    gravity = Gravity.CENTER
                })
            }

            Step.RESULTADO -> {
                content.addView(sectionTitle(if (resultadoSucesso) "✅ Salvo!" else "⚠️ Não foi possível salvar"))
                val detalhe = TextView(this).apply {
                    text = if (resultadoSucesso)
                        if (resultadoEhPagamentoFatura)
                            "Pagamento de R$ $pagamentoValor registrado para $pagamentoCardName."
                        else
                            "${labelForTipo(tipo)} de R$ $valor lançado."
                    else
                        resultadoMensagem
                    setTextColor(colorMuted)
                    textSize = 12f
                    gravity = Gravity.CENTER
                    val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    lp.bottomMargin = dp(16)
                    layoutParams = lp
                }
                content.addView(detalhe)
                if (resultadoSucesso) {
                    content.addView(primaryButton("Fechar") { stopSelf() })
                } else {
                    content.addView(primaryButton("Tentar de novo") {
                        step = if (resultadoEhPagamentoFatura) Step.PAGAR_FATURA else Step.CONFIRMAR
                        showStep()
                    })
                    content.addView(secondaryButton("Fechar") { stopSelf() })
                }
            }
        }

        overlayView = outerWrapper(buildGlassCard(content))
        windowManager.addView(overlayView, overlayLayoutParams())
    }

    /** Card de um cartão na lista "Meus Cartões": nome, uso do mês e botão de pagar fatura. */
    private fun cardUsageCard(c: FirestoreSync.CardUsageDto): LinearLayout {
        val pct = if (c.limit > 0) ((c.used / c.limit) * 100).toInt().coerceIn(0, 100) else 0
        val barColor = when {
            pct > 85 -> colorDanger
            pct > 60 -> Color.parseColor("#F59E0B")
            else -> colorAccent
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = roundedBg(colorFieldBg, radiusDp = 14, strokeColor = colorFieldBorder)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = dp(10)
            layoutParams = lp

            addView(TextView(this@OverlayService).apply {
                text = "${c.name} — ${c.bank} •••• ${c.lastDigits}"
                setTextColor(colorText)
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            })
            addView(TextView(this@OverlayService).apply {
                text = "Usado: R$ ${"%.2f".format(c.used)}  de  R$ ${"%.2f".format(c.limit)}"
                setTextColor(colorMuted)
                textSize = 11f
                val lp2 = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                lp2.topMargin = dp(4); lp2.bottomMargin = dp(8)
                layoutParams = lp2
            })

            val track = FrameLayout(this@OverlayService).apply {
                background = roundedBg(colorTrackBg, radiusDp = 6)
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(6)).apply { bottomMargin = dp(10) }
            }
            track.addView(View(this@OverlayService).apply {
                background = roundedBg(barColor, radiusDp = 6)
            })
            track.post {
                val fillView = track.getChildAt(0)
                fillView.layoutParams = FrameLayout.LayoutParams((track.width * pct / 100f).toInt(), FrameLayout.LayoutParams.MATCH_PARENT)
            }
            addView(track)

            addView(primaryButton("💰 Pagar Fatura") {
                pagamentoCardId = c.id
                pagamentoCardName = c.name
                pagamentoValor = if (c.used > 0) "%.2f".format(c.used) else ""
                pagamentoData = todayIsoStatic()
                step = Step.PAGAR_FATURA
                showStep()
            })
        }
    }

    private fun categoryPill(cat: FirestoreSync.CategoryDto, onClick: () -> Unit): LinearLayout {
        val color = runCatching { Color.parseColor(cat.color ?: "#64748B") }.getOrDefault(colorMuted)
        val softColor = (color and 0x00FFFFFF) or 0x33000000
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = roundedBg(softColor, radiusDp = 14, strokeColor = (color and 0x00FFFFFF) or 0x66000000)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = dp(8)
            layoutParams = lp
            isClickable = true
            isFocusable = true

            addView(View(this@OverlayService).apply {
                layoutParams = LinearLayout.LayoutParams(dp(10), dp(10)).apply { marginEnd = dp(10) }
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(color) }
            })
            addView(TextView(this@OverlayService).apply {
                text = cat.name
                setTextColor(colorText)
                textSize = 14f
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            setOnClickListener { onClick() }
        }
    }

    private fun formatIsoToBr(iso: String): String =
        runCatching { iso.split("-").reversed().joinToString("/") }.getOrDefault(iso)

    private fun parseBrToIso(br: String): String? {
        val parts = br.trim().split("/")
        if (parts.size != 3) return null
        val (d, m, y) = parts
        return runCatching {
            val day = d.padStart(2, '0').toInt()
            val month = m.padStart(2, '0').toInt()
            val year = if (y.length == 2) "20$y" else y
            if (day !in 1..31 || month !in 1..12) return null
            "$year-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}"
        }.getOrNull()
    }

    private fun dateQuickButton(label: String, isoValue: String, selecionado: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(if (selecionado == isoValue) Color.WHITE else colorText)
        textSize = 14f
        background = roundedBg(
            if (selecionado == isoValue) colorAccent else colorFieldBg,
            radiusDp = 14,
            strokeColor = if (selecionado == isoValue) null else colorFieldBorder
        )
        setPadding(dp(16), dp(14), dp(16), dp(14))
        setOnClickListener { onClick() }
        stateListAnimator = null
    }

    private fun temCartoesParaEscolher() = tipo == "expense" && !cartoesCache.isNullOrEmpty()

    private fun proximoPassoAposCategoria(): Step =
        if (temCartoesParaEscolher()) Step.CARTAO else Step.DATA

    /** Botão de seleção de cartão (ou "Nenhum cartão"), com destaque quando selecionado. */
    private fun cardPill(label: String, cardId: String?, selecionado: Boolean, onClick: () -> Unit): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = roundedBg(
                if (selecionado) colorAccentSoft else colorFieldBg,
                radiusDp = 14,
                strokeColor = if (selecionado) colorAccent else colorFieldBorder
            )
            setPadding(dp(14), dp(12), dp(14), dp(12))
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.bottomMargin = dp(8)
            layoutParams = lp
            isClickable = true
            isFocusable = true

            addView(TextView(this@OverlayService).apply {
                text = label
                setTextColor(colorText)
                textSize = 13f
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            if (selecionado) {
                addView(TextView(this@OverlayService).apply {
                    text = "✓"
                    setTextColor(colorAccent)
                    textSize = 15f
                })
            }
            setOnClickListener { onClick() }
        }
    }

    private fun labelForTipo(t: String) = when (t) {
        "income" -> "💰 Receita"
        "investment" -> "📈 Investimento"
        else -> "💸 Despesa"
    }

    private fun stopOverlay() {
        removeOverlayView()
        stopSelf()
    }
}
