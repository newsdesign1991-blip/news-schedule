// 구글 캘린더 공개 .ics를 가져오는 얇은 CORS 프록시.
// 브라우저에서 calendar.google.com/.../basic.ics 를 직접 fetch하면 CORS로 막히기 때문에 필요.
// 보안: 구글 캘린더 ical URL만 허용(오픈 프록시/SSRF 방지).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let body: any = {}
  try { body = await req.json() } catch { /* no body */ }
  const url = (body?.url || '').toString().trim()

  // 구글 캘린더 ical 공개 주소만 허용
  if (!/^https:\/\/calendar\.google\.com\/calendar\/ical\/[^\s"']+\.ics$/.test(url)) {
    return new Response(JSON.stringify({ error: 'invalid url — 구글 캘린더 ical(.ics) 공개 주소만 허용됩니다.' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'nd-schedule/1.0' } })
    if (!r.ok) {
      return new Response(JSON.stringify({ error: 'upstream ' + r.status + ' — 캘린더가 공개 상태인지 확인하세요.' }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const text = await r.text()
    return new Response(text, { headers: { ...CORS, 'Content-Type': 'text/calendar; charset=utf-8' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
