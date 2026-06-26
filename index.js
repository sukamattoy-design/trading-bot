import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID        = process.env.TELEGRAM_CHAT_ID
const GEMINI_KEY     = process.env.GEMINI_API_KEY

async function sendTelegram(text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
  })
}

async function analisisGemini(data) {
  const prompt = `Kamu adalah analis trading profesional.
Analisis data market berikut dan berikan rekomendasi:

Pair     : ${data.symbol}
Harga    : ${data.price}
RSI      : ${data.rsi}
MACD     : ${data.macd}
Signal   : ${data.signal}
EMA 50   : ${data.ema50}
EMA 200  : ${data.ema200}
Timeframe: ${data.tf} menit
Sinyal   : ${data.action}

Berikan analisis singkat:
1. Konfirmasi BUY atau SELL
2. Alasan berdasarkan indikator
3. Level SL yang disarankan
4. Level TP yang disarankan
5. Tingkat keyakinan (rendah/sedang/tinggi)

Jawab dalam Bahasa Indonesia.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  )

  const json = await res.json()
  console.log('Gemini response:', JSON.stringify(json))
if (json.candidates && json.candidates[0]) {
  return json.candidates[0].content.parts[0].text
} else {
  return 'Analisis tidak tersedia: ' + (json.error?.message || JSON.stringify(json))
}
}

app.get('/', (c) => {
  return c.json({ status: '✅ Trading Bot aktif!' })
})

app.post('/alert', async (c) => {
  try {
    const data = await c.req.json()
    console.log('📩 Data masuk:', data)

    const analisis = await analisisGemini(data)
    console.log('🤖 Analisis Gemini:', analisis)

    const emoji = data.action === 'BUY' ? '🟢' : '🔴'
    const pesan = `${emoji} <b>${data.action} ${data.symbol}</b>
💰 Harga: ${data.price}
📊 RSI: ${data.rsi} | MACD: ${data.macd}
⏰ Timeframe: ${data.tf} menit

🤖 <b>Analisis Gemini:</b>
${analisis}`

    await sendTelegram(pesan)

    return c.json({ success: true, analisis })

  } catch (err) {
    console.error('❌ Error:', err)
    return c.json({ success: false, error: err.message }, 500)
  }
})

serve({
  fetch: app.fetch,
  port:  process.env.PORT || 3000
})

console.log('🚀 Server jalan di port', process.env.PORT || 3000)