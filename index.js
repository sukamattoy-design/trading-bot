import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import Anthropic from '@anthropic-ai/sdk'

const app       = new Hono()
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

app.get('/', (c) => {
  return c.json({ status: '✅ Trading Bot aktif!' })
})

app.post('/alert', async (c) => {
  try {
    const data = await c.req.json()
    console.log('📩 Data masuk:', data)

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role:    'user',
        content: `Kamu adalah analis trading profesional.
Analisis data market berikut dan berikan rekomendasi:

Pair    : ${data.symbol}
Harga   : ${data.price}
RSI     : ${data.rsi}
MACD    : ${data.macd}
Signal  : ${data.signal}
EMA 50  : ${data.ema50}
EMA 200 : ${data.ema200}
Timeframe: ${data.tf} menit
Sinyal awal: ${data.action}

Berikan analisis singkat dan jelas:
1. Konfirmasi BUY atau SELL
2. Alasan berdasarkan indikator
3. Level SL (Stop Loss) yang disarankan
4. Level TP (Take Profit) yang disarankan
5. Tingkat keyakinan (rendah/sedang/tinggi)

Jawab dalam Bahasa Indonesia.`
      }]
    })

    const analisis = response.content[0].text
    console.log('🤖 Analisis Claude:', analisis)

    return c.json({
      success:  true,
      symbol:   data.symbol,
      action:   data.action,
      price:    data.price,
      analisis: analisis
    })

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