async function testProxy(name, getUrl) {
  const targetUrl = 'https://play.google.com/store/apps/details?id=com.whatsapp';
  const url = getUrl(targetUrl);
  try {
    const response = await fetch(url);
    console.log(`[${name}] Status:`, response.status);
    if (!response.ok) return null;
    
    let html = '';
    if (name === 'AllOrigins') {
      const data = await response.json();
      html = data.contents || '';
    } else {
      html = await response.text();
    }
    
    console.log(`[${name}] HTML Length:`, html.length);
    if (html.length < 500) {
       console.log(`[${name}] Preview:`, html);
       return null;
    }
    
    let title = '';
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1];
    } else {
      const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleTagMatch) title = titleTagMatch[1];
    }
    title = title.replace(/\s*-\s*Apps on Google Play/gi, '').trim();
    console.log(`[${name}] Title:`, title);
    
    let logoUrl = '';
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImageMatch) {
      logoUrl = ogImageMatch[1];
    }
    console.log(`[${name}] Logo URL:`, logoUrl);
    return html;
  } catch (err) {
    console.error(`[${name}] Error:`, err.message);
    return null;
  }
}

async function run() {
  console.log('Testing Codetabs...');
  await testProxy('Codetabs', (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u));
  
  console.log('\nTesting AllOrigins...');
  await testProxy('AllOrigins', (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u));
}

run();
