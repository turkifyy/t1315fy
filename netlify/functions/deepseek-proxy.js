const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    // 1. التحقق من الطريقة
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' }
    }

    // 2. التحقق من السر الخاص
    const SECRET_KEY = process.env.MY_APP_SECRET;
    const clientSecret = event.headers['x-secret-key'];
    
    if (clientSecret !== SECRET_KEY) {
      return { statusCode: 401, body: 'Unauthorized' }
    }

    // 3. استخراج البيانات
    const { seriesName, episodeNum, linkId } = JSON.parse(event.body);

    // 4. طلب DeepSeek
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
            content: "أنت كاتب محتوى محترف متخصص في المسلسلات تركية المدبلجة الى العرابية وللهجة كل بلد عربي"
          },
          {
            role: "user",
            content: `أنشئ وصفاً تشويقياً للحلقة ${episodeNum} من المسلسل ${seriesName}`
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    // 5. معالجة الاستجابة
    if (!response.ok) {
      throw new Error(`DeepSeek error: ${response.status}`);
    }

    const data = await response.json();
    const description = data.choices[0]?.message?.content || '';
    
    // 6. إرجاع النتيجة
    return {
      statusCode: 200,
      body: JSON.stringify({ description })
    };

  } catch (error) {
    // 7. السقوط الآمن: تسجيل الخطأ
    console.error('Proxy Error:', {
      message: error.message,
      linkId: event.body.linkId,
      timestamp: new Date().toISOString()
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "فشل في توليد الوصف",
        fallback: true
      })
    };
  }
};
