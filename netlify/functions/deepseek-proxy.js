const fetch = require('node-fetch');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-secret-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  try {
    // ﹣ Preflight CORS
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: 'Preflight OK' };
    }

    // ﹣ اسمح فقط بـ POST
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
    }

    // ﹣ تحقق من المفتاح السري
    const SECRET_KEY = process.env.MY_APP_SECRET;
    if (event.headers['x-secret-key'] !== SECRET_KEY) {
      return { statusCode: 401, headers: corsHeaders, body: 'Unauthorized' };
    }

    // ﹣ استخرج البيانات
    const { seriesName, episodeNum, linkId } = JSON.parse(event.body);

    // ﹣ اطلب من DeepSeek
    const deepseekRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "أنت كاتب محتوى محترف متخصص في المسلسلات التركية المدبلجة للعربية" },
          { role: "user",   content: `أنشئ وصفاً تشويقياً للحلقة ${episodeNum} من المسلسل "${seriesName}"` }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!deepseekRes.ok) {
      throw new Error(`DeepSeek Error: ${deepseekRes.status}`);
    }

    const payload = await deepseekRes.json();
    const description = payload.choices?.[0]?.message?.content || '';

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ description })
    };

  } catch (err) {
    // ﹣ سجل الخطأ بأمان
    let linkSafe = null;
    try { linkSafe = JSON.parse(event.body)?.linkId } catch {}
    console.error('Proxy Error:', { message: err.message, linkId: linkSafe, ts: new Date().toISOString() });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "فشل في توليد الوصف", fallback: true })
    };
  }
};
