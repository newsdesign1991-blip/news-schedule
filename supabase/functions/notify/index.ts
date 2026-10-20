import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC') || 'BPbuDNOiXuJN5KpRWINHNtAYVlG3Pq6T6KVJ4ABv9PFn9hv8cfMoQXHCWVbLwqvxteVAkxaN4XKX1KOi5lhAMdc'
const VAPID_EMAIL = Deno.env.get('VAPID_SUBJECT') || 'mailto:sbs8xr@gmail.com'

const WORK_LABELS: Record<string, string> = {
  danjik: '당직', jogeun: '조근', ojende: '오전데스크',
  '8jin': '8진', ilgeun: '일근', newsoh: '뉴스오',
  vw: 'VW 근무', cg: 'CG 근무', general: '근무', off: '휴무'
}

// 브라우저(앱)에서 functions/v1/notify 를 호출하려면 CORS 헤더가 필요하다.
// 없으면 테스트/배포 알림 호출이 'Load failed'(CORS 차단)로 실패한다. (cron은 서버사이드라 영향 없음)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') || ''
  const SB_URL = Deno.env.get('SUPABASE_URL') || ''
  const SB_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!VAPID_PRIVATE) return new Response('VAPID_PRIVATE not set', { status: 500, headers: CORS })

  const sb = createClient(SB_URL, SB_SVC)

  let body: any = {}
  try { body = await req.json() } catch { /* no body */ }
  // 'schedule' = 예전 pg_cron 설정(push-backend/1_supabase_setup.sql)이 보내던 이름 → cron과 같게
  const mode = (body?.mode === 'schedule' ? 'cron' : body?.mode) || 'cron'
  const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  // 모르는 mode는 아무것도 하지 않음(예전엔 cron으로 처리돼, 정각에 다른 호출이 오면 근무 알림이 한 번 더 갈 수 있었음)
  if (!['cron', 'test', 'notice', 'publish', 'prefs', 'seen', 'meal', 'hello', 'direct', 'cue', 'lease', 'cuepull', 'appsub'].includes(mode)) return json({ error: 'unknown mode', mode }, 400)
  // 앱이 'PC 알림'을 켜기 전에 이 함수가 PC 우편함을 아는 판인지 확인(옛 판이면 PC 구독이 휴대폰 알림을 막을 수 있어 앱이 켜지 않음)
  if (mode === 'hello') return json({ ok: true, appInbox: true, direct: true, appSub: true })

  // ── PC 앱 알림 등록(10-20) ── 근무표 앱 endpoint 'ndapp:<PC 고유값>' 은 PC마다 늘 같아서, 껐다 켜거나 이름을 바꿔 다시 켜면 옛 행과 겹쳐 HTTP 409.
  // 웹(anon)은 push_subs 를 읽을 권한이 없어 DELETE ...?endpoint=eq. 가 아무것도 못 지움(RLS: WHERE 가 있는 DELETE 는 SELECT 정책도 필요) → 서버가 대신 바꿈.
  // on=true: 그 PC 행을 지우고 지금 사람으로 새로 넣음 / on=false: 그 PC 행만 지움. ndapp: 행만 다루고 휴대폰 구독은 건드리지 않음. 받는 사람 = 직원 명단에 있는 사람.
  if (mode === 'appsub') {
    const ep = String(body?.endpoint || ''), on = body?.on !== false
    if (!/^ndapp:[A-Za-z0-9-]{8,64}$/.test(ep)) return json({ error: 'bad endpoint' }, 400)
    const { error: de } = await sb.from('push_subs').delete().eq('endpoint', ep)
    if (de) return json({ error: de.message }, 500)
    if (!on) return json({ ok: true, mode: 'appsub', on: false })
    const sid = String(body?.staff_id || '').slice(0, 40), name = String(body?.name || '').slice(0, 20), pr = body?.prefs
    const { data: mr, error: me } = await sb.from('nd_data').select('payload').eq('id', 'main').single()
    if (me) return json({ error: me.message }, 500)
    if (!sid || !((mr?.payload?.staff || []) as any[]).some((s: any) => String(s?.id || '') === sid)) return json({ error: 'unknown staff' }, 400)
    const prefs = pr && typeof pr === 'object' ? { work: pr.work !== false, news: pr.news !== false, notice: pr.notice !== false, poll: pr.poll !== false } : undefined
    const { error: ie } = await sb.from('push_subs').insert({ staff_id: sid, name, endpoint: ep, sub: { endpoint: ep, app: true, ...(prefs ? { prefs } : {}) } })
    if (ie) return json({ error: ie.message }, 500)
    return json({ ok: true, mode: 'appsub', on: true })
  }

  // 호출 확인(10-17): 사이트·PC 앱은 공개 anon 키로 부르고 verify_jwt 도 꺼져 있어(옛 pg_cron 도 anon 키로 'schedule') 누가 불렀는지 모름.
  // 그래서 모드마다 입력을 좁히고 빈도를 막는 정도로 지킴 — cuepull = 믿을 수 있는 호출만(service role 키 또는 x-cue-key = 비밀값 CUE_PULL_KEY), NDS 로그인 2분에 1번,
  // cron = 1분에 1번만 일함(크론 여러 개·반복 호출로 같은 알림이 두 번 가지 않게), cue·lease = 'server' 이름 못 씀, 진입시간 변경 알림 1시간 6번,
  // direct = 보낸 사람은 직원 명단에, 받는 사람은 그날 휴가 신청자여야 함 + 보낸 사람마다 10분 20번, notice 10분 12번·글자 수 제한, publish 10분 3번, test = 한 사람만(10분 5번).
  // 남은 위험: anon 키로 nd_data 를 직접 고칠 수 있는 구조라(js/data-save.js) 빈도 기록(ratelimit 행)·큐시트(cue)를 지우거나 바꿀 수 있고,
  // 남의 staff_id 로 공지·휴가 조정 알림을 보내는 것도 여전히 됨 — 막으려면 사이트가 직원 세션 토큰(employee-auth)을 같이 보내고 여기서 확인해야 함
  const _same = (a: string, b: string) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0 }
  const _svcKeys = [SB_SVC]
  try { const j = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}'); if (j && typeof j === 'object') for (const v of Object.values(j)) _svcKeys.push(String(v || '')) } catch { /* 새 형식 키 목록 없음 */ }
  const _bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim(), _apikey = (req.headers.get('apikey') || '').trim()
  const trusted = _svcKeys.some(k => _same(_bearer, k) || _same(_apikey, k)) || _same((req.headers.get('x-cue-key') || '').trim(), Deno.env.get('CUE_PULL_KEY') || '')
  if (mode === 'cuepull' && !trusted) return json({ error: 'forbidden' }, 403)   // 누구나 부르면 회사 NDS 공용 계정 로그인을 반복시켜 계정이 막힐 수 있음
  // 호출 빈도 제한: nd_data id='ratelimit' payload { 키: [부른 시각(ms)…] } — winMs 안에 max 번 찼으면 false. 창은 1시간까지(1시간 지난 기록은 정리)
  // 읽기·쓰기가 안 되면 막지 않음(진짜 알림이 빠지지 않게)
  async function rateOk(key: string, max: number, winMs: number): Promise<boolean> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: row, error } = await sb.from('nd_data').select('payload, updated_at').eq('id', 'ratelimit').maybeSingle()
      if (error) return true
      const t = Date.now(), pay: any = {}
      for (const [k, v] of Object.entries((row?.payload && typeof row.payload === 'object') ? row.payload : {})) { const L = (Array.isArray(v) ? v : []).filter((x: any) => typeof x === 'number' && t - x < 3600e3); if (L.length) pay[k] = L }
      const L = (pay[key] || []).filter((x: number) => t - x < winMs)
      if (L.length >= max) return false
      pay[key] = L.concat([t])
      const nowIso = new Date().toISOString()
      if (!row) { const { error: ie } = await sb.from('nd_data').insert({ id: 'ratelimit', payload: pay, updated_at: nowIso }); if (!ie) return true }
      else { const { data: upd, error: ue } = await sb.from('nd_data').update({ payload: pay, updated_at: nowIso }).eq('id', 'ratelimit').eq('updated_at', row.updated_at).select('id'); if (!ue && upd && upd.length) return true }
      await new Promise(r => setTimeout(r, 40 + attempt * 60 + Math.floor(Math.random() * 120)))
    }
    return true
  }
  // 글자 수 자르기(이모지가 반쪽 나지 않게 글자 단위). 잘렸으면 '…'
  const clip = (v: any, n: number) => { const a = Array.from(String(v || '').replace(/\r/g, '').trim()); return a.length > n ? a.slice(0, n).join('') + '…' : a.join('') }

  // ── 식단(WISE 목동) 저장 모드 ────────────────────────────────────
  // WISE 창에서 즐겨찾기(meal-import.js)가 로그인된 세션으로 읽은 식단을 보냄. 근무표 문서(main)가 아닌 별도 행 nd_data id='meal'.
  // payload = { days: { 'YYYY-MM-DD': { 조식|중식|석식: { A|B|C: '메뉴' } } }, from, to, upto, fetchedAt }
  // 이번에 확인한 기간(from~to)은 받은 것으로 통째로 바꿈(그사이 빠진 메뉴도 반영), 나머지 날은 그대로. 45일 지난 날은 정리.
  // 받은 메뉴가 하나도 없으면 아무것도 지우지 않고 거절(잘못된 가져오기로 저장본이 비는 것 방지).
  // 일 자리표(10-17): 근무표 PC 앱 여럿 중 1대만 할 일(식단 가져오기 'meal') — nd_data id='leases' { key:{ dev, name, until } }.
  // 다른 PC가 살아 있는 자리표를 들고 있으면 lease:false. release 면 내 자리표를 내려놓음(가져오기 실패 등)
  if (mode === 'lease') {
    const key = String(body?.key || '')
    if (!['meal'].includes(key)) return json({ error: 'bad key' }, 400)
    const dev = String(body?.dev || '').replace(/[^\w-]/g, '').slice(0, 64), who = String(body?.name || '').slice(0, 20)
    if (!dev) return json({ error: 'dev required' }, 400)
    if (/^server$/i.test(dev)) return json({ error: 'bad dev' }, 400)   // 'server' = 서버 자리(PC 이름으로 못 씀)
    const release = !!body?.release, ttl = Math.min(Math.max(Number(body?.ttl) || 10, 1), 30) * 60e3
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: row, error } = await sb.from('nd_data').select('payload, updated_at').eq('id', 'leases').maybeSingle()
      if (error) return json({ error: error.message }, 500)
      const pay: any = (row?.payload && typeof row.payload === 'object') ? { ...row.payload } : {}
      const L = pay[key]
      if (L && L.dev && L.dev !== dev && Date.parse(L.until || '') > Date.now()) return json({ ok: true, lease: false, holder: String(L.name || '') })
      if (release) { if (!L || L.dev !== dev) return json({ ok: true, lease: false }); delete pay[key] }
      else pay[key] = { dev, name: who, until: new Date(Date.now() + ttl).toISOString() }
      const nowIso = new Date().toISOString()
      if (!row) { const { error: ie } = await sb.from('nd_data').insert({ id: 'leases', payload: pay, updated_at: nowIso }); if (!ie) return json({ ok: true, lease: !release }) }
      else { const { data: upd, error: ue } = await sb.from('nd_data').update({ payload: pay, updated_at: nowIso }).eq('id', 'leases').eq('updated_at', row.updated_at).select('id'); if (!ue && upd && upd.length) return json({ ok: true, lease: !release }) }
      await new Promise(r => setTimeout(r, 40 + attempt * 60 + Math.floor(Math.random() * 120)))
    }
    return json({ error: 'busy' }, 409)
  }

  // NDS 큐시트 방송 시작 시각(근무표 PC 앱 js/news-cue.js 가 NDS 공용 계정으로 읽어 보냄) → nd_data id='cue'(main 과 별도). 60일 보관
  // 담당 PC 1대만(10-17): payload.leader = { dev, name, until(20분) } — 다른 PC가 살아 있는 자리표를 들고 있으면 저장하지 않고 leader:false.
  // days 없이 부르면 자리표만 잡음/늘림. 저장 때 오늘 8뉴스·오뉴스 시각이 '바뀌면'(전에도 값 있음) 아래(구독 읽은 뒤)에서 그날 8진·뉴오에게 변경 알림.
  let cueChanged: { k: string, from: string, to: string }[] = []
  // 큐시트 저장(nd_data id='cue', 60일): 담당 자리표 leader(20분) — force 가 아니면 다른 담당이 살아 있을 때 저장 안 함. 오늘 시각이 바뀌면 chg
  async function cueStore(dev: string, who: string, clean: any, hasDays: boolean, force: boolean) {
    const nowIso = new Date().toISOString()
    const kToday = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    const cutoff = new Date(Date.now() + 9 * 3600e3 - 60 * 864e5).toISOString().slice(0, 10)
    let result: any = null, chg: { k: string, from: string, to: string }[] = []
    for (let attempt = 0; attempt < 8 && !result; attempt++) {
      const { data: row, error } = await sb.from('nd_data').select('payload, updated_at').eq('id', 'cue').maybeSingle()
      if (error) return { result: { error: error.message }, chg }
      const pay0: any = (row?.payload && typeof row.payload === 'object') ? row.payload : {}
      const L = pay0.leader
      if (!force && L && L.dev && L.dev !== dev && Date.parse(L.until || '') > Date.now()) { result = { ok: true, leader: false, holder: String(L.name || '') }; break }
      const old: any = (pay0.days && typeof pay0.days === 'object') ? pay0.days : {}
      const days: any = {}
      for (const k of Object.keys(old)) if (k >= cutoff) days[k] = old[k]
      for (const ds of Object.keys(clean)) days[ds] = { ...clean[ds], sent: old[ds]?.sent || {} }   // 크론이 보낸 표시는 그대로
      const c2: { k: string, from: string, to: string }[] = []
      if (clean[kToday] && old[kToday]) for (const k of ['news8', 'newsOh']) { const x = String(old[kToday][k] || ''), y = String(clean[kToday][k] || ''); if (x && y && x !== y) c2.push({ k, from: x, to: y }) }
      const pay = { ...pay0, days, leader: { dev, name: who, until: new Date(Date.now() + 20 * 60e3).toISOString() }, fetchedAt: hasDays ? nowIso : (pay0.fetchedAt || '') }
      if (!row) {
        const { error: ie } = await sb.from('nd_data').insert({ id: 'cue', payload: pay, updated_at: nowIso })
        if (!ie) { chg = c2; result = { ok: true, leader: true } }
      } else {
        const { data: upd, error: ue } = await sb.from('nd_data').update({ payload: pay, updated_at: nowIso }).eq('id', 'cue').eq('updated_at', row.updated_at).select('id')
        if (!ue && upd && upd.length) { chg = c2; result = { ok: true, leader: true } }
      }
      if (!result) await new Promise(r => setTimeout(r, 40 + attempt * 60 + Math.floor(Math.random() * 120)))
    }
    return { result, chg }
  }
  // NDS 큐시트를 서버가 직접(10-17 — 담당 PC가 꺼져 있어도): 비밀값 NDS_ID·NDS_PW(supabase secrets set — 코드·웹·설치판엔 없음).
  // NDS '로컬 로그인'(공용 계정) → /cuesheet 목록 → 로그아웃. 프로그램 고르기는 js/news-cue.js _cuePick 과 같게. 서버가 담당(leader 'server')이 되면 PC들은 안 읽음
  const CUE_8 = /8시\s*뉴스|8\s*뉴스/, CUE_OH = /^(SBS\s*)?오\s*뉴스/, CUE_SKIP = /\(R\)|스포츠|예고|재방|하이라이트/
  async function serverCue(): Promise<any> {
    const NDS_ID = Deno.env.get('NDS_ID') || '', NDS_PW = Deno.env.get('NDS_PW') || ''
    if (!NDS_ID || !NDS_PW) return { ok: false, error: 'no secret' }
    if (!(await rateOk('ndslogin', 1, 120e3))) return { ok: false, error: 'too soon' }   // 공용 계정 로그인은 2분에 1번까지(로그인 실패 포함 — 계정 잠김 방지)
    const API ='https://nds-api.sbs.co.kr/api', H: any = { 'content-type': 'application/json', 'X-App-Version': '1.0.602' }
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
    const addD = (ds: string, n: number) => new Date(Date.parse(ds + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
    const d10 = (v: any) => { const x = String(v || '').replace(/\D/g, ''); return x.length >= 8 ? `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}` : '' }
    const hm = (v: any) => { const m = /^(\d{1,2}):?(\d{2})/.exec(String(v || '').trim()); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '' }
    const call = async (method: string, url: string, token?: string, body?: any) => {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000)
      try {
        const r = await fetch(API + url, { method, signal: ac.signal, headers: token ? { ...H, Authorization: 'Bearer ' + token } : H, body: body ? JSON.stringify(body) : undefined })
        let j: any = null; try { j = await r.json() } catch { /* 본문 없음 */ }
        return { status: r.status, json: j }
      } finally { clearTimeout(t) }
    }
    const { data: crow } = await sb.from('nd_data').select('payload').eq('id', 'cue').maybeSingle()
    const od: any = crow?.payload?.days || {}
    const past = Object.keys(od).filter(d => d < today && d >= addD(today, -28) && od[d]?.news8).length
    const from = past < 10 ? addD(today, -28) : today, to = addD(today, 1)   // 평소 시각 셈에 지난 4주가 모자라면 같이
    let token = ''
    try {
      const lg = await call('POST', '/auth/login', undefined, { appDivCd: 'web', chDivId: 1, userId: NDS_ID, pwd: NDS_PW, isSaveID: false })
      token = lg.json?.data?.accessToken || ''
      if (!token) return { ok: false, error: `login ${lg.status} ${String(lg.json?.message || '').slice(0, 80)}` }
      const list: any[] = []
      let ch = false
      for (let page = 0; page < 30; page++) {
        let r = await call('GET', `/cuesheet?sdate=${from}&edate=${to}${ch ? '&chDivIds=1' : ''}&page=${page}&size=200`, token)
        if (page === 0 && r.status !== 200) { ch = true; r = await call('GET', `/cuesheet?sdate=${from}&edate=${to}&chDivIds=1&page=0&size=200`, token) }
        if (r.status !== 200 || !r.json) return { ok: false, error: 'list ' + r.status }
        const d = r.json.data || {}, rows = Array.isArray(d) ? d : (d.content || [])
        for (const c of rows) list.push({ name: String(c?.brdcPgmNm || '').slice(0, 60), date: d10(c?.brdcDt), start: hm(c?.brdcStartTime) })
        if (Array.isArray(d) || !d.totalPages || page + 1 >= d.totalPages) break
      }
      const clean: any = {}, nowIso = new Date().toISOString()
      for (let ds = from; ds <= to; ds = addD(ds, 1)) {
        const day = list.filter(c => c.date === ds && /^\d{2}:\d{2}$/.test(c.start))
        if (!day.length && ds !== today) continue
        const first = (re: RegExp) => day.filter(c => re.test(c.name) && !CUE_SKIP.test(c.name)).map(c => c.start).sort()[0] || ''
        const seen = new Set<string>(), progs: any[] = []
        day.slice().sort((a, b) => a.start.localeCompare(b.start)).forEach(c => { const k = c.name + '|' + c.start; if (seen.has(k) || progs.length >= 60) return; seen.add(k); progs.push({ n: c.name, s: c.start }) })
        clean[ds] = { news8: first(CUE_8), newsOh: first(CUE_OH), progs, at: nowIso }
      }
      const st = await cueStore('server', '서버', clean, true, true)
      return { ok: !!st.result?.leader, changed: st.chg, today: clean[today] ? { news8: clean[today].news8, newsOh: clean[today].newsOh } : null, days: Object.keys(clean).length }
    } catch (e: any) {
      return { ok: false, error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) }
    } finally {
      if (token) await call('POST', '/auth/logout', token).catch(() => {})
    }
  }

  if (mode === 'cue') {
    const RE = /^\d{4}-\d{2}-\d{2}$/, HM = /^\d{2}:\d{2}$/
    const dev = String(body?.dev || '').replace(/[^\w-]/g, '').slice(0, 64), who = String(body?.name || '').slice(0, 20)
    if (!dev) return json({ error: 'dev required' }, 400)
    if (/^server$/i.test(dev)) return json({ error: 'bad dev' }, 400)   // 'server' = 서버 담당(serverCue) 자리 — 밖에서 이 이름을 쓰면 서버 자리표를 무시하고 덮어쓸 수 있었음
    const hasDays =!!(body?.days && typeof body.days === 'object')
    const nowIso = new Date().toISOString()
    const clean: any = {}
    let n = 0
    if (hasDays) {
      const from = String(body?.from || ''), to = String(body?.to || '')
      if (!RE.test(from) || !RE.test(to) || from > to || (Date.parse(to) - Date.parse(from)) / 864e5 > 40) return json({ error: 'bad range' }, 400)
      for (const ds of Object.keys(body.days).slice(0, 45)) {
        const d = body.days[ds]
        if (!RE.test(ds) || ds < from || ds > to || !d || typeof d !== 'object') continue
        const progs = Array.isArray(d.progs) ? d.progs.slice(0, 60).map((p: any) => ({ n: String(p?.n || '').slice(0, 60), s: HM.test(String(p?.s || '')) ? String(p.s) : '' })).filter((p: any) => p.n && p.s) : []
        clean[ds] = { news8: HM.test(String(d.news8 || '')) ? String(d.news8) : '', newsOh: HM.test(String(d.newsOh || '')) ? String(d.newsOh) : '', progs, at: nowIso }
        n++
      }
      if (!n) return json({ error: 'empty' }, 400)
    }
    const st = await cueStore(dev, who, clean, hasDays, false)
    if (!st.result) return json({ error: 'busy' }, 409)
    if (st.result.error) return json(st.result, 500)
    cueChanged = st.chg
    if (!st.result.leader || !cueChanged.length) return json({ ...st.result, count: n })
    // 바뀐 게 있으면 → 아래 '진입시간 변경 알림'으로 이어감
  }

  if (mode === 'meal') {
    const RE = /^\d{4}-\d{2}-\d{2}$/
    const from = String(body?.from || ''), to = String(body?.to || '')
    if (!RE.test(from) || !RE.test(to) || from > to || (Date.parse(to) - Date.parse(from)) / 864e5 > 120) return json({ error: 'bad range' }, 400)
    const inDays = (body?.days && typeof body.days === 'object') ? body.days : {}
    const clean: any = {}
    let n = 0
    for (const ds of Object.keys(inDays).slice(0, 200)) {
      const d = inDays[ds]
      if (!RE.test(ds) || ds < from || ds > to || !d || typeof d !== 'object') continue
      const o: any = {}
      for (const m of ['조식', '중식', '석식']) {
        const v = d[m]; if (!v || typeof v !== 'object') continue
        const c: any = {}
        for (const k of ['A', 'B', 'C']) { const t = typeof v[k] === 'string' ? v[k].replace(/\r/g, '').trim().slice(0, 600) : ''; if (t) c[k] = t }
        if (Object.keys(c).length) o[m] = c
      }
      if (Object.keys(o).length) { clean[ds] = o; n++ }
    }
    if (!n) return json({ error: 'empty' }, 400)
    const cutoff = new Date(Date.now() + 9 * 3600e3 - 45 * 864e5).toISOString().slice(0, 10)   // 한국 날짜 기준 45일 전
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: row, error } = await sb.from('nd_data').select('payload, updated_at').eq('id', 'meal').maybeSingle()
      if (error) return json({ error: error.message }, 500)
      const old: any = (row?.payload && typeof row.payload === 'object' && row.payload.days && typeof row.payload.days === 'object') ? row.payload.days : {}
      const days: any = {}
      for (const k of Object.keys(old)) if (k >= cutoff && (k < from || k > to)) days[k] = old[k]
      Object.assign(days, clean)
      const keys = Object.keys(days).sort()
      const nowIso = new Date().toISOString()
      const pay = { days, from, to, upto: keys[keys.length - 1] || '', fetchedAt: nowIso }
      if (!row) {
        const { error: ie } = await sb.from('nd_data').insert({ id: 'meal', payload: pay, updated_at: nowIso })
        if (!ie) return json({ ok: true, count: n, upto: pay.upto })
      } else {
        const { data: upd, error: ue } = await sb.from('nd_data').update({ payload: pay, updated_at: nowIso }).eq('id', 'meal').eq('updated_at', row.updated_at).select('id')
        if (!ue && upd && upd.length) return json({ ok: true, count: n, upto: pay.upto })
      }
      await new Promise(r => setTimeout(r, 40 + attempt * 60 + Math.floor(Math.random() * 120)))
    }
    return json({ error: 'busy' }, 409)
  }

  // ── 공지 '확인함' 기록·조회 모드 ─────────────────────────────────
  // 앱에서 공지 확인 창을 열면 호출. 근무표 문서(nd_data id='main')에 쓰면 저장 번호가 올라가 다른 사람의 다음 저장이 막히므로
  // 별도 행(nd_data id='seen', 저장 번호 검사 트리거는 main에만 걸림)에 {공지 id: {at: 처음 기록, s: {직원 id: 시각}}}로 저장.
  // staff_id가 비어 있으면 조회만. updated_at 낙관적 잠금 + 재시도로 동시에 여러 명이 열어도 빠지지 않음. 60일 지난 공지 기록은 정리.
  if (mode === 'seen') {
    const nid = String(body?.notice_id || ''), sid = String(body?.staff_id || '')
    if (!nid || nid.length > 80 || sid.length > 80) return json({ error: 'notice_id required' }, 400)
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: row, error } = await sb.from('nd_data').select('payload, updated_at').eq('id', 'seen').maybeSingle()
      if (error) return json({ error: error.message }, 500)
      const pay: any = (row?.payload && typeof row.payload === 'object') ? row.payload : {}
      const ent: any = pay[nid] || { at: new Date().toISOString(), s: {} }
      const until = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.until || '')) ? String(body.until) : ''
      if (until && (!ent.until || until > ent.until)) ent.until = until   // 게시 종료일(정리 기준) — 늦은 쪽을 보관
      if (!sid || ent.s?.[sid]) return json({ seen: ent.s || {} })
      ent.s = { ...(ent.s || {}), [sid]: new Date().toISOString() }
      pay[nid] = ent
      const cutoff = Date.now() - 60 * 864e5
      // 정리: 처음 기록과 게시 종료일 중 늦은 날이 60일 지난 공지만(오래 게시 중인 공지·지금 기록 중인 공지는 안 지움)
      for (const k of Object.keys(pay)) { if (k === nid) continue; const t = Math.max(Date.parse(pay[k]?.at || '') || 0, Date.parse(pay[k]?.until || '') || 0); if (t && t < cutoff) delete pay[k] }
      const nowIso = new Date().toISOString()
      if (!row) {
        const { error: ie } = await sb.from('nd_data').insert({ id: 'seen', payload: pay, updated_at: nowIso })
        if (!ie) return json({ seen: ent.s })
      } else {
        const { data: upd, error: ue } = await sb.from('nd_data').update({ payload: pay, updated_at: nowIso }).eq('id', 'seen').eq('updated_at', row.updated_at).select('id')
        if (!ue && upd && upd.length) return json({ seen: ent.s })
      }
      await new Promise(r => setTimeout(r, 40 + attempt * 60 + Math.floor(Math.random() * 120)))
    }
    return json({ error: 'busy' }, 409)
  }

  // ── 개인 알림 설정 저장 모드 ─────────────────────────────────────
  // 앱 '알림 설정' 시트에서 바꾼 값을 이 기기 구독 행(push_subs.sub.prefs)에만 반영. 구독 행을 지우거나 새로 만들지 않음.
  // 웹(anon)은 push_subs를 읽을 권한이 없어 직접 고칠 수 없으므로 서버(service role)가 대신 고침. endpoint + staff_id가 둘 다 맞는 행만.
  if (mode === 'prefs') {
    const ep = String(body?.endpoint || ''), sid = String(body?.staff_id || ''), pr = body?.prefs
    if (!ep || !sid || !pr || typeof pr !== 'object') return json({ error: 'endpoint, staff_id, prefs required' }, 400)
    const clean = { work: pr.work !== false, news: pr.news !== false, notice: pr.notice !== false, poll: pr.poll !== false }
    const { data: rows, error } = await sb.from('push_subs').select('endpoint, sub').eq('endpoint', ep).eq('staff_id', sid)
    if (error) return json({ error: error.message }, 500)
    let updated = 0
    for (const r of rows || []) {
      const { error: ue } = await sb.from('push_subs').update({ sub: { ...(r.sub || {}), prefs: clean } }).eq('endpoint', r.endpoint).eq('staff_id', sid)
      if (!ue) updated++
    }
    return json({ updated, found: (rows || []).length, mode: 'prefs', prefs: clean })
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)

  // KST 기준 현재 시각
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600000)
  const todayStr = kst.toISOString().slice(0, 10)
  const curMin = kst.getUTCHours() * 60 + kst.getUTCMinutes()

  // push_subs 로드
  const { data: rawSubs, error: subsErr } = await sb.from('push_subs').select('*')
  if (subsErr) return new Response('push_subs read error: ' + subsErr.message, { status: 500, headers: CORS })
  if (!rawSubs?.length && mode !== 'direct') return new Response(JSON.stringify({ sent: 0, reason: 'no subscribers' }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  // 같은 사람(staff_id)이 여러 기기/재구독으로 행을 2개 이상 가져도 1건만 발송 → 알림 2번 가는 문제 방지.
  // (staff_id가 없는 행은 endpoint로 폴백 dedup) — 모든 모드(cron/test/notice/publish)가 이 subs를 순회하므로 전부 적용됨.
  // 같은 사람 행이 여러 개면 가장 최근 행(개인 알림 설정이 최신)을 남김
  const _t = (s: any) => s.created_at ? Date.parse(s.created_at) : (Number(s.id) || 0)
  rawSubs.sort((a: any, b: any) => _t(b) - _t(a))
  // PC 앱(근무표 앱 설치판 — Electron은 웹 푸시를 못 받음) 구독은 endpoint 'ndapp:<PC 고유값>' — 휴대폰 구독과 따로 1건씩
  const isApp = (s: any) => String(s?.endpoint || '').startsWith('ndapp:')
  const _seenKey = new Set<string>()
  const subs = (rawSubs || []).filter((s: any) => { const k = (s.staff_id || s.endpoint) + (isApp(s) ? '|app' : ''); if (_seenKey.has(k)) return false; _seenKey.add(k); return true; })

  // PC 앱 우편함: nd_data id='appinbox_<PC 고유값>' payload.items 에 쌓아 두면 앱(desktop/app-notify.js)이 30초마다 읽어 윈도 알림으로 띄움.
  // 최근 30건·3일만 보관. 저장 번호 검사 트리거는 main 에만 걸려 있음. updated_at 낙관적 잠금 + 재시도.
  async function appInbox(sub: any, payload: string) {
    const dev = String(sub.endpoint).slice(6).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
    if (!dev) throw new Error('bad app endpoint')
    const id = 'appinbox_' + dev
    let p: any = {}; try { p = JSON.parse(payload) } catch { /* 글자 그대로 */ }
    const item = { id: Date.now() * 1000 + Math.floor(Math.random() * 1000), at: new Date().toISOString(), title: String(p.title || '근무표'), body: String(p.body || ''), tag: String(p.tag || '') }
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: row, error } = await sb.from('nd_data').select('payload, updated_at').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      const cut = Date.now() - 3 * 864e5
      const items = ((row?.payload?.items || []) as any[]).filter((x: any) => Date.parse(x?.at || '') > cut).concat([item]).slice(-30)
      const nowIso = new Date().toISOString()
      if (!row) {
        const { error: ie } = await sb.from('nd_data').insert({ id, payload: { items }, updated_at: nowIso })
        if (!ie) return
      } else {
        const { data: upd, error: ue } = await sb.from('nd_data').update({ payload: { items }, updated_at: nowIso }).eq('id', id).eq('updated_at', row.updated_at).select('id')
        if (!ue && upd && upd.length) return
      }
      await new Promise(r => setTimeout(r, 40 + attempt * 60 + Math.floor(Math.random() * 120)))
    }
    throw new Error('appinbox busy')
  }
  // 보내기: 휴대폰·브라우저 = 웹 푸시, PC 앱 = 우편함
  const deliver = (sub: any, payload: string) => isApp(sub) ? appInbox(sub, payload) : webpush.sendNotification(sub.sub, payload)

  let sent = 0, errors = 0
  // 개인 알림 설정(앱 '알림 설정' 시트 → push_subs.sub.prefs): work=근무 알림, news=8진·뉴오 진행 알림, notice=공지, poll=투표.
  // 설정이 없는 예전 구독은 전부 켜진 것으로 봄(지금까지와 같게)
  const pref = (s: any, key: string) => s?.sub?.prefs?.[key] !== false

  // 오늘 진입시간이 바뀜 → 그날 8진(8뉴스)·뉴오(오뉴스)에게(휴가인 사람 빼고, '8진·뉴오 진행 알림' 켠 사람만)
  // 안 보냄: 알림 제어 '전체 알림' 끔(크론과 같게), 8뉴스를 공지에 직접 넣은 날(8진 알림은 그 시각 기준), 바뀐 시각이 이미 지남(다시 갈 알림 없음), 1시간 6번 넘음
  async function sendCueChanged(list: { k: string, from: string, to: string }[]) {
    if (!list.length) return
    const { data: mr } = await sb.from('nd_data').select('payload').eq('id', 'main').single()
    const nd0: any = mr?.payload || {}
    if (!nd0?.settings?.notify?.enabled) return
    const e: any = nd0.schedule?.[todayStr] || {}
    const off = new Set<string>((nd0.newLeaves?.[todayStr]) || [])
    const man8 = nd0.notices?.[todayStr]?.news8Time, hasMan8 = !!(man8 && /^\d{1,2}:\d{2}$/.test(String(man8)))
    const toMinOf = (v: any) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : -1 }
    const types: any[] = nd0.settings.notify.types || []
    for (const c of list) {
      if (c.k === 'news8' && hasMan8) continue
      const toMin = toMinOf(c.to)
      if (toMin < 0 || curMin >= toMin) continue
      const ids = (c.k === 'news8' ? [e.weekday8jin, e.weekend8jin, e.weekday8jin2, e.weekend8jin2] : [e.newsOh, e.newsOh2]).filter((x: any) => x && !off.has(x)).map(String)
      const targets = subs.filter((x: any) => ids.includes(String(x.staff_id)) && pref(x, 'news'))
      if (!targets.length) continue
      if (!(await rateOk('cuechg', 6, 3600e3))) break
      const label = c.k === 'news8' ? '8뉴스' : '오뉴스'
      // 다시 갈 알림: 8뉴스 = 8진 근무 알림(알림 제어 8진 켜짐), 오뉴스 = 오뉴스 진행(newsohGo, 설정 없으면 켜짐). 이미 20분 안이면 다음 크론에 바로
      const t8 = types.find((t: any) => t.key === '8jin'), tOh = types.find((t: any) => t.key === 'newsohGo')
      const again = c.k === 'news8' ? !!(t8?.enabled && t8.time) : tOh?.enabled !== false
      const tail = again ? (curMin >= toMin - 20 ? ' 알림은 곧 다시 가요.' : ` 알림은 ${c.to} 20분 전에 다시 가요.`) : ''
      const payload = JSON.stringify({ title: `⏰ ${label} 진입시간 변경`, body: `오늘 ${label} 진입시간이 ${c.from} → ${c.to}(으)로 바뀌었어요.${tail}`, icon: 'icon-192.png', badge: 'icon-192.png', tag: `cuechg-${c.k}-${todayStr}-${c.to}`, renotify: true, data: { url: './' } })
      for (const sub of targets) {
        try { await deliver(sub, payload); sent++ }
        catch (err: any) { errors++; if (err.statusCode === 410 || err.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint) }
      }
    }
  }
  if (mode === 'cue') {
    await sendCueChanged(cueChanged)
    return json({ ok: true, leader: true, changed: cueChanged, sent, errors })
  }
  // 크론은 1분에 1번만 일함(GitHub Actions 실행 겹침·옛 pg_cron·밖에서 반복 호출 — 그 분 근무 알림이 두 번 가지 않게)
  if (mode === 'cron' && !(await rateOk('cron@' + kst.toISOString().slice(0, 16), 1, 3600e3))) return json({ sent: 0, reason: 'already ran this minute' })
  // 서버가 NDS 직접: 크론이면 06:00~21:30, 오후(14:00~20:30) 5분·그 외 15분마다. cuepull = 지금 한 번(시험·확인용 — 믿을 수 있는 호출만, 로그인 2분 간격은 같음)
  if (mode === 'cuepull' || (mode === 'cron' && curMin >= 360 && curMin <= 1290 && curMin % ((curMin >= 840 && curMin <= 1230) ? 5 : 15) === 0)) {
    const r = await serverCue()
    if (r.changed && r.changed.length) await sendCueChanged(r.changed)
    if (mode === 'cuepull') return json({ ...r, sent, errors })
  }

  // ── 직접 알림 모드(휴가 조정 요청 등) ────────────────────────────
  // 앱 휴가신청(js/leave-request.js)에서 그 날 6번째 이후로 신청하거나 데스크가 비게 되면, 먼저 신청한 사람들에게.
  // 받는 사람마다 알림함(nd_data id='alarms' payload[직원 id] — 앱 '알림함', 60일·100건)에 쌓고 그 사람들 기기(휴대폰·PC 앱)로 알림.
  if (mode === 'direct') {
    const KINDS: Record<string, string> = { leave: '🗓 휴가 조정 요청', desk: '🧭 데스크 조정 요청' }
    const kind = KINDS[String(body?.kind || '')] ? String(body.kind) : ''
    const toIn = Array.isArray(body?.to) ? [...new Set(body.to.map((x: any) => String(x)).filter((x: string) => /^[\w-]{1,40}$/.test(x)))].slice(0, 30) as string[] : []
    const from = String(body?.from || '').slice(0, 40), fromName = String(body?.fromName || '').slice(0, 20)
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date || '')) ? String(body.date) : ''
    const text = String(body?.text || '').trim().slice(0, 300)
    if (!kind || !toIn.length || !text || !from || !date) return json({ error: 'kind, to, text, from, date required' }, 400)
    // 보낸 사람 = 직원 명단에 있는 사람, 받는 사람 = 그날 휴가 신청자(leave·desk 둘 다 '먼저 신청한 사람'에게만 감 — js/leave-request.js _lrConflicts)
    const { data: mr, error: me } = await sb.from('nd_data').select('payload').eq('id', 'main').single()
    if (me) return json({ error: me.message }, 500)
    const staffIds = new Set<string>(((mr?.payload?.staff || []) as any[]).map((s: any) => String(s?.id || '')))
    if (!staffIds.has(from)) return json({ error: 'unknown from' }, 400)
    const applied = new Set<string>(((mr?.payload?.leaveReq?.entries?.[date] || []) as any[]).map(String))
    const to = toIn.filter(id => id !== from && staffIds.has(id) && applied.has(id))
    if (!to.length) return json({ sent: 0, errors: 0, stored: false, mode: 'direct', reason: 'no recipients' })
    if (!trusted && !(await rateOk('direct:' + from, 20, 600e3))) return json({ error: 'too many', mode: 'direct' }, 429)
    const title = KINDS[kind]
    let stored = false
    for (let attempt = 0; attempt < 8 && !stored; attempt++) {
      const { data: row, error } = await sb.from('nd_data').select('payload, updated_at').eq('id', 'alarms').maybeSingle()
      if (error) return json({ error: error.message }, 500)
      const pay: any = (row?.payload && typeof row.payload === 'object') ? row.payload : {}
      const nowIso = new Date().toISOString(), cut = Date.now() - 60 * 864e5
      for (const sid of to) {
        const L = (Array.isArray(pay[sid]) ? pay[sid] : []).filter((x: any) => Date.parse(x?.at || '') > cut)
        L.push({ id: Date.now() * 1000 + Math.floor(Math.random() * 1000), at: nowIso, kind, title, body: text, date, from, fromName })
        pay[sid] = L.slice(-100)
      }
      if (!row) {
        const { error: ie } = await sb.from('nd_data').insert({ id: 'alarms', payload: pay, updated_at: nowIso })
        if (!ie) stored = true
      } else {
        const { data: upd, error: ue } = await sb.from('nd_data').update({ payload: pay, updated_at: nowIso }).eq('id', 'alarms').eq('updated_at', row.updated_at).select('id')
        if (!ue && upd && upd.length) stored = true
      }
      if (!stored) await new Promise(r => setTimeout(r, 40 + attempt * 60 + Math.floor(Math.random() * 120)))
    }
    const payload = JSON.stringify({ title, body: text, icon: 'icon-192.png', badge: 'icon-192.png', tag: `${kind}-${date}-${Date.now()}`, renotify: true, data: { url: './' } })
    for (const sub of subs.filter((x: any) => to.includes(String(x.staff_id)))) {
      try { await deliver(sub, payload); sent++ }
      catch (e: any) {
        errors++
        if (e.statusCode === 410 || e.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint)
      }
    }
    return json({ sent, errors, stored, mode: 'direct' })
  }

  // ── 테스트 모드 ──────────────────────────────────────────────────
  // 버튼으로 즉시 호출. staff_id 주면 본인 기기에만(사람마다 10분 5번), 전체 테스트(staff_id 없음)는 믿을 수 있는 호출만.
  if (mode === 'test') {
    const target = String(body?.staff_id || '').slice(0, 40)
    if (!target && !trusted) return json({ error: 'staff_id required' }, 400)
    const list = target ? subs.filter(s => String(s.staff_id) === target) : subs
    if (target && list.length && !trusted && !(await rateOk('test:' + target, 5, 600e3))) return json({ error: 'too many', mode: 'test' }, 429)
    const payload = JSON.stringify({
      title: '🔔 테스트 알림',
      body: '푸시 알림이 정상 작동합니다! 이 알림이 보이면 설정 완료예요.',
      icon: 'icon-192.png', badge: 'icon-192.png',
      tag: 'test-' + Date.now(), renotify: true,
      data: { url: './' }
    })
    for (const sub of list) {
      try { await deliver(sub, payload); sent++ }
      catch (e: any) {
        errors++
        if (e.statusCode === 410 || e.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint)
      }
    }
    return new Response(JSON.stringify({ sent, errors, mode: 'test' }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ── 공지 등록 알림 모드 ──────────────────────────────────────────
  if (mode === 'notice') {
    const kind = body?.kind === 'poll' ? 'poll' : 'notice'
    // 알림 글은 짧게(긴 공지는 앱에서 봄 — 웹 푸시 본문은 약 4KB 넘으면 못 보냄), 전 직원에게 가므로 10분 12번까지
    const text = clip(body?.text, 300)
    const title = clip(body?.title, 60) || '📢 공지사항이 등록되었습니다'
    if (!trusted && !(await rateOk('notice', 12, 600e3))) return json({ error: 'too many', mode: 'notice' }, 429)
    const payload = JSON.stringify({
      title,
      body: text || '새 공지를 확인하세요.',
      icon: 'icon-192.png', badge: 'icon-192.png',
      tag: 'notice-' + Date.now(), renotify: true,
      data: { url: './' }
    })
    for (const sub of subs) {
      if (!pref(sub, kind)) continue
      try { await deliver(sub, payload); sent++ }
      catch (e: any) {
        errors++
        if (e.statusCode === 410 || e.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint)
      }
    }
    return new Response(JSON.stringify({ sent, errors, mode: 'notice', kind }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ── 배포 알림 모드 ──────────────────────────────────────────────
  // body.token 은 배포 시각 글자(js/publish.js label)라 확인할 값이 아님 — 전 직원에게 가므로 10분 3번까지
  if (mode === 'publish') {
    if (!trusted && !(await rateOk('publish', 3, 600e3))) return json({ error: 'too many', mode: 'publish' }, 429)
    const payload = JSON.stringify({
      title: '📅 근무표가 업데이트되었습니다',
      body: '새 근무표를 확인하세요.',
      icon: 'icon-192.png', badge: 'icon-192.png',
      tag: `publish-${todayStr}`, data: { url: './' }
    })
    for (const sub of subs) {
      try { await deliver(sub, payload); sent++ }
      catch (e: any) {
        errors++
        if (e.statusCode === 410 || e.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint)
      }
    }
    return new Response(JSON.stringify({ sent, errors, mode: 'publish' }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ── 크론 알림 모드 ──────────────────────────────────────────────
  const { data: ndRow } = await sb.from('nd_data').select('payload').eq('id', 'main').single()
  const nd = ndRow?.payload
  if (!nd?.settings?.notify?.enabled) {
    return new Response(JSON.stringify({ sent: 0, reason: 'notify disabled in settings' }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  const cfg = nd.settings.notify
  const entry = nd?.schedule?.[todayStr] || null
  // NDS 큐시트 오늘 방송 시작(js/news-cue.js → mode 'cue'). 8진·오뉴스 진행 알림 = 시작 20분 전
  const { data: cueRow } = await sb.from('nd_data').select('payload').eq('id', 'cue').maybeSingle()
  const cueT: any = cueRow?.payload?.days?.[todayStr] || null
  const _hmMin = (v: any) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : -1 }
  // 오늘 오뉴스 없음 확정: 오후 1시(한국) 넘어 가져온 큐시트에도 없을 때(그 전엔 아직 안 만들었을 수 있음)
  const _cueAtKst = cueT?.at ? new Date(Date.parse(cueT.at) + 9 * 3600e3) : null
  const noNewsOh = !!(cueT && !cueT.newsOh && _cueAtKst && (_cueAtKst.toISOString().slice(0, 10) > todayStr || (_cueAtKst.toISOString().slice(0, 10) === todayStr && _cueAtKst.getUTCHours() >= 13)))   // 전날 받아 둔 기록은 확정 아님
  // 진입 20분 전 ~ 진입 전까지 아직 그 시각으로 안 보냈으면 보냄(크론이 한두 분 빠지거나 시간이 당겨져도 놓치지 않게). 보낸 진입시각은 cue days[오늘].sent 에 남김
  const _sentMk: any = cueT?.sent || {}
  const _man8 = nd?.notices?.[todayStr]?.news8Time
  const n8Use = _man8 && /^\d{1,2}:\d{2}$/.test(_man8) ? String(_man8) : (_hmMin(cueT?.news8) >= 0 ? String(cueT.news8) : '')   // 공지에 직접 넣은 시각이 먼저
  const n8Min = _hmMin(n8Use), ohMin = _hmMin(cueT?.newsOh)
  const due8 = n8Min >= 0 && curMin >= n8Min - 20 && curMin < n8Min && _sentMk.news8 !== n8Use
  const dueOh = ohMin >= 0 && curMin >= ohMin - 20 && curMin < ohMin && _sentMk.newsOh !== String(cueT.newsOh)
  const leaves = new Set<string>((nd?.newLeaves?.[todayStr]) || [])

  // 그날 '평일 틀'인지(앱 js/core.js isWeekdayForm과 같은 규칙): 토·일 아님 + (공휴일 아님 | 특정일 news 'weekday' | 지정 없고 이름에 설·추석 없음)
  const _dowT = new Date(todayStr + 'T00:00:00Z').getUTCDay()
  const _hn = nd?.holidays?.[todayStr]
  const _news = nd?.settings?.specialDays?.[todayStr]?.news
  const _wdForm = _dowT !== 0 && _dowT !== 6 && (!_hn || _news === 'weekday' || (_news !== 'weekend' && !/설|추석/.test(String(_hn))))
  // 그날 부서(부서 이동 deptSchedule 반영 — js/core.js deptOn 과 같은 규칙: start<=오늘 중 가장 늦은 것, 없으면 기준부서 s.dept)
  const _deptOn = (s: any) => { let best: any = null; for (const h of (Array.isArray(s?.deptSchedule) ? s.deptSchedule : [])) if (h && h.start && h.dept && h.start <= todayStr && (!best || h.start > best.start)) best = h; return best ? best.dept : s?.dept }
  // 표에서 빈칸(회색)인 날 — js/core.js isDispatched(직원 파견 기간)·isContractActive(프리랜서 계약 기간 밖)와 같은 규칙
  const _outToday = (s: any) => {
    if (s?.employmentType === 'employee' && (s.dispatchStart || s.dispatchEnd) && !(s.dispatchStart && todayStr < s.dispatchStart) && !(s.dispatchEnd && todayStr > s.dispatchEnd)) return true
    return s?.employmentType === 'freelancer' && !!((s.contractStart && todayStr < s.contractStart) || (s.contractEnd && todayStr > s.contractEnd))
  }
  const _offOr = () => cfg.types?.find((t: any) => t.key === 'off')?.enabled ? 'off' : null
  function getWorkType(staffId: string, staff: any): string | null {
    if (leaves.has(staffId)) return null
    if (staff && (staff.active === false || _outToday(staff))) return null   // 비활성·파견 중·계약 기간 밖은 알림 없음
    if (!entry) return _offOr()
    if (entry.danjik === staffId) return 'danjik'
    if (entry.satMorning === staffId) return 'jogeun'   // 토요 조근(표 '조근', 알림 제어 '조근 (평일·토요)')
    if (entry.morningDesk === staffId) return 'ojende'
    if ([entry.weekday8jin, entry.weekend8jin, entry.weekday8jin2, entry.weekend8jin2].includes(staffId)) return '8jin'
    if (entry.ilgeun === staffId) return 'ilgeun'
    if (entry.newsOh === staffId || entry.newsOh2 === staffId) return 'newsoh'
    if ((entry.restWorkers || []).includes(staffId)) return _offOr()   // 쉬는 사람(표 빈칸)
    if ((entry.jogeunEdu || []).includes(staffId)) return 'jogeun'     // 교육 조근(표 '조근')
    // 조근 부서(그날 부서): 표 조근 열(js/table-view.js)과 같은 순서 — VW·CG 에 넣었으면 그 근무, 아니면 평일 틀은 조근, 주말 틀은 쉼(주말 8진은 위에서)
    if (_deptOn(staff) === '조근') {
      if (!_wdForm) return _offOr()
      if ((entry.vw?.workers || []).includes(staffId)) return 'vw'
      if ((entry.cg?.workers || []).includes(staffId)) return 'cg'
      return 'jogeun'
    }
    if (_wdForm && entry.jogeunSubs && Object.values(entry.jogeunSubs as Record<string, string>).includes(staffId)) return 'jogeun'   // 조근 대타(표처럼 평일 틀만)
    if ((entry.jogeunExtra || []).includes(staffId)) return 'jogeun'   // 엑셀·브러시로 넣은 조근 대체
    if ((entry.vw?.workers || []).includes(staffId)) return 'vw'
    if ((entry.cg?.workers || []).includes(staffId)) return 'cg'
    if ((entry.xr || []).includes(staffId)) return 'general'
    if ((entry.project || []).includes(staffId)) return 'general'
    if ((entry.sports || []).includes(staffId)) return 'general'
    return _offOr()
  }

  for (const sub of subs) {
    const staff = nd?.staff?.find((s: any) => s.id === sub.staff_id)
    const wt = getWorkType(sub.staff_id, staff)
    if (!wt) continue
    // 뉴.오(뉴스오) 근무자: 그날 근무 알림과 따로 '오뉴스 진행' 알림(알림 제어 'newsohGo', 설정이 없으면 16:30·켜짐).
    // PC 앱은 제목 '오뉴스 진행'을 보고 화면 테두리 빨간 강조 알림(desktop/alert.js)
    if (wt === 'newsoh' && pref(sub, 'news')) {
      const g = (cfg.types || []).find((t: any) => t.key === 'newsohGo') || { enabled: true, time: '16:30' }
      // 큐시트 오뉴스 시작을 알면 20분 전(dueOh), 오늘 오뉴스가 없으면 안 보냄, 모르면 설정 시각 그 분에
      const goNow = ohMin >= 0 ? dueOh : (!noNewsOh && curMin === _hmMin(g.time))
      if (g.enabled !== false && goNow) {
        const name = staff?.name || sub.name || ''
        const tmpl = String(g.body || '').trim()
        const when = ohMin >= 0 ? String(cueT.newsOh) : String(g.time)
        let bodyText = tmpl ? tmpl.replace(/\{이름\}/g, name).replace(/\{근무\}/g, '오뉴스 진행').replace(/\{시각\}/g, when).replace(/\{진입\}/g, when) : `${name}님, 오뉴스 진행 시간입니다.`
        if (ohMin >= 0 && !bodyText.includes(String(cueT.newsOh))) bodyText += ` (오뉴스 ${cueT.newsOh} 진입)`
        try {
          await deliver(sub, JSON.stringify({ title: '📺 오뉴스 진행 알림', body: bodyText, icon: 'icon-192.png', badge: 'icon-192.png', tag: `newsohgo-${todayStr}-${sub.staff_id}`, data: { url: './' } }))
          sent++
        } catch (e: any) {
          errors++
          if (e.statusCode === 410 || e.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint)
        }
      }
    }
    if (!pref(sub, (wt === '8jin' || wt === 'newsoh') ? 'news' : 'work')) continue   // 8진·뉴오는 '8진·뉴오 진행 알림', 나머지는 '근무 알림'

    const typeCfg = (cfg.types || []).find((t: any) => t.key === wt)
    if (!typeCfg?.enabled || !typeCfg.time) continue

    const [h, m] = typeCfg.time.split(':').map(Number)
    let targetMin = h * 60 + m
    // 8진: 8뉴스 진입 20분 전(due8 — 공지에 직접 넣은 '8뉴스 진입시간'이 먼저, 없으면 NDS 큐시트). 진입시간을 모르면 설정 시각 그 분에
    const n8: string = wt === '8jin' ? n8Use : ''
    if (n8) { if (!due8) continue }
    else if (curMin !== targetMin) continue  // 정확히 그 분에만 발송 (매 분 호출 → 하루 1회, 중복 방지)

    const label = WORK_LABELS[wt] || '근무'
    const name = staff?.name || sub.name || ''
    // 관리자가 알림 제어 탭에서 편집한 메시지(typeCfg.body) 사용. {이름}/{근무}/{시각} 치환.
    const tmpl = (typeCfg.body || '').trim()
    let bodyText = tmpl
      ? tmpl.replace(/\{이름\}/g, name).replace(/\{근무\}/g, label).replace(/\{시각\}/g, n8 || typeCfg.time || '').replace(/\{진입\}/g, n8 || '')
      : (wt === 'off' ? `${name}님, 오늘은 근무가 없습니다.` : `${name}님, 오늘 ${label}입니다.`)
    if (n8 && !bodyText.includes(n8)) bodyText += ` (8뉴스 ${n8} 진입)`

    try {
      await deliver(sub, JSON.stringify({
        title: `📅 오늘 근무 알림 — ${label}`,
        body: bodyText,
        icon: 'icon-192.png', badge: 'icon-192.png',
        tag: `work-${todayStr}-${sub.staff_id}`,
        data: { url: './' }
      }))
      sent++
    } catch (e: any) {
      errors++
      if (e.statusCode === 410 || e.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint)
    }
  }

  if (due8 || dueOh) {   // 이 진입시각으로는 보냈음(같은 시각으로 다시 안 보냄, 시각이 바뀌면 새로)
    // 오늘 큐시트 칸이 없어도(NDS 를 못 읽은 날 공지에 넣은 8뉴스 시각만 있을 때) sent 틀만 만들어 남김 — 안 남기면 20분 동안 크론마다 다시 감.
    // 나중에 큐시트를 받으면 cueStore 가 old.sent 를 그대로 가져감. cue 행이 아예 없으면 새로 만듦
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data: row, error: re } = await sb.from('nd_data').select('payload, updated_at').eq('id', 'cue').maybeSingle()
      if (re) break
      const p: any = (row?.payload && typeof row.payload === 'object') ? { ...row.payload } : {}
      p.days = (p.days && typeof p.days === 'object') ? { ...p.days } : {}
      const sm = { ...(p.days[todayStr]?.sent || {}) }
      if (due8) sm.news8 = n8Use
      if (dueOh) sm.newsOh = String(cueT.newsOh)
      p.days[todayStr] = { ...(p.days[todayStr] || {}), sent: sm }
      const nowIso = new Date().toISOString()
      if (!row) { const { error: ie } = await sb.from('nd_data').insert({ id: 'cue', payload: p, updated_at: nowIso }); if (!ie) break }
      else { const { data: upd, error: ue } = await sb.from('nd_data').update({ payload: p, updated_at: nowIso }).eq('id', 'cue').eq('updated_at', row.updated_at).select('id'); if (!ue && upd && upd.length) break }
      await new Promise(r => setTimeout(r, 40 + attempt * 60))
    }
  }

  return new Response(JSON.stringify({ sent, errors, kst: kst.toISOString(), todayStr }), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
})
