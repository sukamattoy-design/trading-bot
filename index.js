import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID        = process.env.TELEGRAM_CHAT_ID
const GROQ_KEY       = process.env.GROQ_API_KEY

async function sendTelegram(text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
  })
}

async function analisisGroq(text) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role:    'system',
          content: 'Kamu adalah analis trading profesional XAUUSD (Gold). Jawab dalam Bahasa Indonesia, singkat dan jelas.'
        },
        {
          role:    'user',
          content: text
        }
      ],
      max_tokens: 500
    })
  })

  const json = await res.json()
  console.log('Groq response:', JSON.stringify(json))
  if (json.choices && json.choices[0]) {
    return json.choices[0].message.content
  } else {
    return 'Analisis tidak tersedia: ' + (json.error?.message || JSON.stringify(json))
  }
}

// Endpoint webhook TradingView
app.post('/alert', async (c) => {
  try {
    const data = await c.req.json()
    console.log('📩 Data masuk:', data)

    const analisis = await analisisGroq(
      `Sinyal ${data.action} ${data.symbol} harga ${data.price} RSI ${data.rsi} MACD ${data.macd} EMA50 ${data.ema50} EMA200 ${data.ema200} TF ${data.tf} menit. Berikan analisis singkat: konfirmasi BUY/SELL, alasan, SL, TP, tingkat keyakinan.`
    )

    const emoji = data.action === 'BUY' ? '🟢' : '🔴'
    const pesan = `${emoji} <b>${data.action} ${data.symbol}</b>
💰 Harga: ${data.price}
📊 RSI: ${data.rsi} | MACD: ${data.macd}
⏰ Timeframe: ${data.tf} menit

🤖 <b>Analisis AI:</b>
${analisis}`

    await sendTelegram(pesan)
    return c.json({ success: true, analisis })

  } catch (err) {
    console.error('❌ Error:', err)
    return c.json({ success: false, error: err.message }, 500)
  }
})

// Endpoint terima pesan manual dari Telegram
app.post('/telegram', async (c) => {
  try {
    const data = await c.req.json()
    const pesan = data.message?.text
    console.log('📨 Pesan Telegram:', pesan)

    if (!pesan) return c.json({ ok: true })

    const analisis = await analisisGroq(pesan)
    await sendTelegram(`🤖 <b>Analisis:</b>\n${analisis}`)

    return c.json({ ok: true })

  } catch (err) {
    console.error('❌ Error:', err)
    return c.json({ ok: false })
  }
})

app.get('/', (c) => {
  return c.json({ status: '✅ Trading Bot aktif!' })
})

serve({
  fetch: app.fetch,
  port:  process.env.PORT || 3000
})

console.log('🚀 Server jalan di port', process.env.PORT || 3000)