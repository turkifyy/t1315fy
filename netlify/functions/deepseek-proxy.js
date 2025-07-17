const fetch = require('node-fetch');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-secret-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  try {
    // 1. الرد على طلب OPTIONS (preflight)
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: 'Preflight OK'
      };
    }

    // 2. رفض أي طلب غير POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: 'Method Not Allowed'
      };
    }

    // 3. التحقق من المفتاح السري
    const SECRET_KEY = process.env.MY_APP_SECRET;
    const clientSecret = event.headers['x-secret-key'];

    if (!clientSecret || clientSecret !== SECRET_KEY) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: 'Unauthorized'
      };
    }

    // 4. استخراج البيانات من الطلب
    const { seriesName, episodeNum, linkId } = JSON.parse(event.body);

    // 5. طلب DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "أنت كاتب محتوى محترف متخصص في المسلسلات التركية المدبلجة للعربية، باللهجات المحلية لكل بلد عربي"
          },
          {
            role: "user",
            content: `أنشئ وصفاً تشويقياً للحلقة ${episodeNum} من المسلسل "${seriesName}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    // 6. التأكد من نجاح الطلب
    if (!response.ok) {
      throw new Error(`DeepSeek Error: ${response.status}`);
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content || '';

    // 7. الرد الناجح
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ description })
    };

  } catch (error) {
    // 8. معالجة الأخطاء
    console.error('Proxy Error:', {
      message: error.message,
      linkId: (() => {
        try {
          return JSON.parse(event.body)?.linkId;
        } catch (_) {
          return null;
        }
      })(),
      timestamp: new Date().toISOString()
    });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "فشل في توليد الوصف من DeepSeek",
        fallback: true
      })
    };
  }
};
