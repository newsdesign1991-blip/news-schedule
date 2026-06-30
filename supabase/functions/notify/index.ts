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
  const mode = body?.mode || 'cron'

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)

  // KST 기준 현재 시각
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600000)
  const todayStr = kst.toISOString().slice(0, 10)
  const curMin = kst.getUTCHours() * 60 + kst.getUTCMinutes()

  // push_subs 로드
  const { data: rawSubs, error: subsErr } = await sb.from('push_subs').select('*')
  if (subsErr) return new Response('push_subs read error: ' + subsErr.message, { status: 500, headers: CORS })
  if (!rawSubs?.length) return new Response(JSON.stringify({ sent: 0, reason: 'no subscribers' }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  // 같은 사람(staff_id)이 여러 기기/재구독으로 행을 2개 이상 가져도 1건만 발송 → 알림 2번 가는 문제 방지.
  // (staff_id가 없는 행은 endpoint로 폴백 dedup) — 모든 모드(cron/test/notice/publish)가 이 subs를 순회하므로 전부 적용됨.
  const _seenKey = new Set<string>()
  const subs = rawSubs.filter((s: any) => { const k = s.staff_id || s.endpoint; if (_seenKey.has(k)) return false; _seenKey.add(k); return true; })

  let sent = 0, errors = 0

  // ── 테스트 모드 ──────────────────────────────────────────────────
  // 버튼으로 즉시 호출. staff_id 주면 본인 기기에만, 없으면 전체에 테스트 발송.
  if (mode === 'test') {
    const target = body?.staff_id
    const list = target ? subs.filter(s => s.staff_id === target) : subs
    const payload = JSON.stringify({
      title: '🔔 테스트 알림',
      body: '푸시 알림이 정상 작동합니다! 이 알림이 보이면 설정 완료예요.',
      icon: 'icon-192.png', badge: 'icon-192.png',
      tag: 'test-' + Date.now(), renotify: true,
      data: { url: './' }
    })
    for (const sub of list) {
      try { await webpush.sendNotification(sub.sub, payload); sent++ }
      catch (e: any) {
        errors++
        if (e.statusCode === 410 || e.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint)
      }
    }
    return new Response(JSON.stringify({ sent, errors, mode: 'test' }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ── 공지 등록 알림 모드 ──────────────────────────────────────────
  if (mode === 'notice') {
    const text = (body?.text || '').toString().trim()
    const title = (body?.title || '').toString().trim() || '📢 공지사항이 등록되었습니다'
    const payload = JSON.stringify({
      title,
      body: text || '새 공지를 확인하세요.',
      icon: 'icon-192.png', badge: 'icon-192.png',
      tag: 'notice-' + Date.now(), renotify: true,
      data: { url: './' }
    })
    for (const sub of subs) {
      try { await webpush.sendNotification(sub.sub, payload); sent++ }
      catch (e: any) {
        errors++
        if (e.statusCode === 410 || e.statusCode === 404) await sb.from('push_subs').delete().eq('endpoint', sub.endpoint)
      }
    }
    return new Response(JSON.stringify({ sent, errors, mode: 'notice' }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ── 배포 알림 모드 ──────────────────────────────────────────────
  if (mode === 'publish') {
    const payload = JSON.stringify({
      title: '📅 근무표가 업데이트되었습니다',
      body: '새 근무표를 확인하세요.',
      icon: 'icon-192.png', badge: 'icon-192.png',
      tag: `publish-${todayStr}`, data: { url: './' }
    })
    for (const sub of subs) {
      try { await webpush.sendNotification(sub.sub, payload); sent++ }
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
  const leaves = new Set<string>((nd?.newLeaves?.[todayStr]) || [])

  function getWorkType(staffId: string, staff: any): string | null {
    if (leaves.has(staffId)) return null
    if (!entry) return cfg.types?.find((t: any) => t.key === 'off')?.enabled ? 'off' : null
    if (entry.danjik === staffId) return 'danjik'
    if (entry.morningDesk === staffId || entry.satMorning === staffId) return 'ojende'
    if (entry.weekday8jin === staffId || entry.weekend8jin === staffId) return '8jin'
    if (entry.ilgeun === staffId) return 'ilgeun'
    if (entry.newsOh === staffId) return 'newsoh'
    if (staff?.dept === '조근') return 'jogeun'
    if (entry.jogeunSubs && Object.values(entry.jogeunSubs as Record<string, string>).includes(staffId)) return 'jogeun'
    if ((entry.vw?.workers || []).includes(staffId)) return 'vw'
    if ((entry.cg?.workers || []).includes(staffId)) return 'cg'
    if ((entry.xr || []).includes(staffId)) return 'general'
    if ((entry.project || []).includes(staffId)) return 'general'
    if ((entry.sports || []).includes(staffId)) return 'general'
    return cfg.types?.find((t: any) => t.key === 'off')?.enabled ? 'off' : null
  }

  for (const sub of subs) {
    const staff = nd?.staff?.find((s: any) => s.id === sub.staff_id)
    const wt = getWorkType(sub.staff_id, staff)
    if (!wt) continue

    const typeCfg = (cfg.types || []).find((t: any) => t.key === wt)
    if (!typeCfg?.enabled || !typeCfg.time) continue

    const [h, m] = typeCfg.time.split(':').map(Number)
    let targetMin = h * 60 + m
    // 8진: 오늘 공지에 '8뉴스 진입시간'이 있으면 그 15분 전으로 알림 시각을 변경
    if (wt === '8jin') {
      const n8 = nd?.notices?.[todayStr]?.news8Time
      if (n8 && /^\d{1,2}:\d{2}$/.test(n8)) {
        const [nh, nm] = n8.split(':').map(Number)
        targetMin = nh * 60 + nm - 15
        if (targetMin < 0) targetMin += 1440
      }
    }
    if (curMin !== targetMin) continue  // 정확히 그 분에만 발송 (매 분 호출 → 하루 1회, 중복 방지)

    const label = WORK_LABELS[wt] || '근무'
    const name = staff?.name || sub.name || ''
    // 관리자가 알림 제어 탭에서 편집한 메시지(typeCfg.body) 사용. {이름}/{근무}/{시각} 치환.
    const tmpl = (typeCfg.body || '').trim()
    const bodyText = tmpl
      ? tmpl.replace(/\{이름\}/g, name).replace(/\{근무\}/g, label).replace(/\{시각\}/g, typeCfg.time || '')
      : (wt === 'off' ? `${name}님, 오늘은 근무가 없습니다.` : `${name}님, 오늘 ${label}입니다.`)

    try {
      await webpush.sendNotification(sub.sub, JSON.stringify({
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

  return new Response(JSON.stringify({ sent, errors, kst: kst.toISOString(), todayStr }), {
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
})
