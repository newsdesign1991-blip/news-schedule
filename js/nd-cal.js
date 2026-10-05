/* [모듈] js/nd-cal.js — 팝업용 날짜 달력·시간 직접 입력 공통 부품 | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// 넓은 화면(≥1001px) 입력 팝업에서 시스템 날짜/시간 선택기 대신 쓰는 우리 스타일 위젯. 모바일은 CSS로 숨기고 기존 input 그대로 씀.
// ndCal(host, {get, set, min, onPick, mark})  → {sync(), render()}   host 안에 iOS식 달력. get()='YYYY-MM-DD'|'' , set(ds), mark(ds)=true면 날짜 아래 점
//   range:true 이면 기간 고르기 — get()={from,to}, set({from,to}). 첫 클릭=시작, 두 번째=끝(앞날짜면 시작을 바꿈), 세 번째=새로 시작
//   range + fixedFrom:'YYYY-MM-DD' 이면 시작은 고정, 누르는 날짜가 끝
// ndTime(host, {get, set, optional, presets}) → {sync()}      '시 : 분' 두 칸 직접 입력(↑↓로 조절) + 자주 쓰는 시간 칩
// ndDateInput(input, host) / ndTimeInput(input, host, o)   기존 <input type=date|time>을 원본으로 두고 위젯이 그 값을 읽고 씀
//   → 팝업을 열 때 input.value를 바꾼 뒤 host._ndCal.sync() / host._ndTime.sync()를 부르면 위젯이 따라감
(function(){
  var W = '일월화수목금토';
  function pad(n){ return String(n).padStart(2, '0'); }
  function today(){ var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function chev(dir){ return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (dir < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6') + '"/></svg>'; }
  function holiday(ds){ try { return (typeof data !== 'undefined' && data.holidays && data.holidays[ds]) || ''; } catch(e){ return ''; } }
  function fmtLong(ds){ var d = new Date(ds + 'T00:00:00'); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + W[d.getDay()] + ')'; }

  // ===== 달력 =====
  window.ndCal = function(host, o){
    if(host._ndCal){ host._ndCal.opts(o); host._ndCal.sync(); return host._ndCal; }
    o = o || {};
    var y, m, focusDs = '';
    host.classList.add('ndc');
    function rng(){ var r = (o.get && o.get()) || {}; return { from: r.from || '', to: r.to || '' }; }
    function cur(){ return o.range ? rng().from : ((o.get && o.get()) || ''); }
    function jump(){ var b = cur() || today(); y = +b.slice(0, 4); m = +b.slice(5, 7); }
    function ds(d){ return y + '-' + pad(m) + '-' + pad(d); }
    function render(fk){
      var c = cur(), t = today(), lead = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
      var R = o.range ? rng() : null;
      var min = o.min || '', atMin = min && (y * 12 + m <= +min.slice(0, 4) * 12 + +min.slice(5, 7));
      var tabDs = (c && c.slice(0, 7) === y + '-' + pad(m)) ? c : (t.slice(0, 7) === y + '-' + pad(m) ? t : ds(1));
      if(min && tabDs < min) tabDs = min.slice(0, 7) === y + '-' + pad(m) ? min : tabDs;
      var cells = '<span></span>'.repeat(lead);
      for(var d = 1; d <= days; d++){
        var s = ds(d), dow = (lead + d - 1) % 7, hol = holiday(s), dis = min && s < min;
        var sel = R ? (s === R.from || s === R.to) : s === c, mid = R && R.from && R.to && s > R.from && s < R.to;
        var rc = R && R.from && R.to && R.from !== R.to ? (s === R.from ? ' r-start' : s === R.to ? ' r-end' : '') : '';
        var mk = o.mark && o.mark(s);
        cells += '<span class="ndc-cell' + (mid ? ' in-range' : '') + rc + '"><button type="button" class="ndc-day' + (dow === 0 || hol ? ' sun' : dow === 6 ? ' sat' : '') + (s === t ? ' is-today' : '') + (sel ? ' is-sel' : '') + (mk ? ' has-mark' : '') + '" data-d="' + s + '" tabindex="' + (s === tabDs ? 0 : -1) + '"' +
          (dis ? ' disabled' : '') + ' aria-pressed="' + sel + '" aria-label="' + m + '월 ' + d + '일 ' + W[dow] + '요일' + (hol ? ' ' + hol : '') + (s === t ? ', 오늘' : '') + (R && s === R.from ? ', 시작일' : '') + (R && s === R.to ? ', 종료일' : '') + (mk ? ', ' + (o.markLabel || '표시된 날') : '') + '"' + (hol ? ' title="' + hol + '"' : '') + '>' + d + '</button></span>';
      }
      var selTxt = R ? (R.from ? (R.to === R.from ? fmtLong(R.from) + ' 하루' : fmtLong(R.from) + ' ~ ' + (R.to ? fmtLong(R.to) : '<em>끝 날짜 선택</em>')) : '시작 날짜를 골라 주세요') : (c ? fmtLong(c) : '날짜를 골라 주세요');
      host.innerHTML = '<div class="ndc-head"><button type="button" class="ndc-title" data-a="today" data-f="title" title="이번 달로">' + y + '년 ' + m + '월</button>' +
        '<div class="ndc-nav"><button type="button" data-a="prev" data-f="prev" aria-label="이전 달"' + (atMin ? ' disabled' : '') + '>' + chev(-1) + '</button><button type="button" data-a="next" data-f="next" aria-label="다음 달">' + chev(1) + '</button></div></div>' +
        '<div class="ndc-week" aria-hidden="true">' + W.split('').map(function(w, i){ return '<span' + (i === 0 ? ' class="sun"' : i === 6 ? ' class="sat"' : '') + '>' + w + '</span>'; }).join('') + '</div>' +
        '<div class="ndc-grid" role="group" aria-label="' + y + '년 ' + m + '월">' + cells + '</div>' +
        '<div class="ndc-foot"><span class="ndc-sel' + (c ? '' : ' empty') + '">' + selTxt + '</span>' +
        (R ? '' : '<button type="button" class="ndc-today" data-a="pick-today" data-f="pt">오늘</button>') + '</div>';
      if(fk){ var el = host.querySelector(fk.indexOf('d:') === 0 ? '[data-d="' + fk.slice(2) + '"]' : '[data-f="' + fk + '"]'); if(!el || el.disabled) el = host.querySelector('.ndc-day[tabindex="0"]'); if(el) el.focus(); }
    }
    function nav(dm, fk){
      var ny = y, nm = m + dm; if(nm < 1){ nm = 12; ny--; } if(nm > 12){ nm = 1; ny++; }
      if(o.min && ny * 12 + nm < +o.min.slice(0, 4) * 12 + +o.min.slice(5, 7)) return false;
      y = ny; m = nm; render(fk); return true;
    }
    function pick(s, keepFocus){
      if(o.min && s < o.min) return;
      if(o.range && o.fixedFrom){ if(o.set) o.set({ from: o.fixedFrom, to: s < o.fixedFrom ? o.fixedFrom : s }); }   // 시작 고정(예: 공지 게시 = 오늘부터) → 누른 날이 끝
      else if(o.range){ var r = rng(); if(o.set) o.set(!r.from || r.to || s < r.from ? { from: s, to: '' } : { from: r.from, to: s }); }
      else if(o.set) o.set(s);
      y = +s.slice(0, 4); m = +s.slice(5, 7); render(keepFocus ? 'd:' + s : '');
      if(o.onPick) o.onPick(s);
    }
    host.addEventListener('click', function(e){
      var b = e.target.closest('button'); if(!b || !host.contains(b) || b.disabled) return;
      var a = b.dataset.a, fk = document.activeElement === b ? (b.dataset.d ? 'd:' + b.dataset.d : b.dataset.f) : '';
      if(b.dataset.d){ pick(b.dataset.d, !!fk); return; }
      if(a === 'prev') nav(-1, fk); else if(a === 'next') nav(1, fk);
      else if(a === 'today'){ var t = today(); y = +t.slice(0, 4); m = +t.slice(5, 7); render(fk); }
      else if(a === 'pick-today') pick(today(), false);
    });
    // 날짜 위에서 ←→↑↓(하루·한 주) / PageUp·PageDown(한 달) / Home·End(주 처음·끝)
    host.addEventListener('keydown', function(e){
      var b = e.target.closest && e.target.closest('.ndc-day'); if(!b) return;
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key], d = new Date(b.dataset.d + 'T00:00:00');
      if(step) d.setDate(d.getDate() + step);
      else if(e.key === 'PageUp' || e.key === 'PageDown'){ var dd = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + (e.key === 'PageUp' ? -1 : 1)); d.setDate(Math.min(dd, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }   // 1/31 → 2/28(달 건너뜀 방지)
      else if(e.key === 'Home') d.setDate(d.getDate() - d.getDay());
      else if(e.key === 'End') d.setDate(d.getDate() + 6 - d.getDay());
      else return;
      e.preventDefault();
      var s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      if(o.min && s < o.min){ s = o.min; d = new Date(s + 'T00:00:00'); }   // 고를 수 없는 날 너머로는 그 첫날에 멈춤
      var el = host.querySelector('[data-d="' + s + '"]');
      if(el){ host.querySelectorAll('.ndc-day[tabindex="0"]').forEach(function(x){ x.tabIndex = -1; }); el.tabIndex = 0; el.focus(); }
      else { y = d.getFullYear(); m = d.getMonth() + 1; render('d:' + s); var f = host.querySelector('[data-d="' + s + '"]'); if(f){ host.querySelectorAll('.ndc-day[tabindex="0"]').forEach(function(x){ x.tabIndex = -1; }); f.tabIndex = 0; f.focus(); } }
    });
    var api = { opts: function(n){ o = n || o; }, sync: function(){ jump(); render(); }, render: function(){ render(); } };
    host._ndCal = api; jump(); render();
    return api;
  };

  // ===== 시간 직접 입력 =====
  window.ndTime = function(host, o){
    if(host._ndTime){ host._ndTime.opts(o); host._ndTime.sync(); return host._ndTime; }
    o = o || {};
    var presets = o.presets || ['09:00', '10:00', '11:00', '14:00', '15:00', '18:00'];
    host.classList.add('ndt');
    host.innerHTML = '<div class="ndt-box" role="group" aria-label="시간 입력"><input class="ndt-h" inputmode="numeric" maxlength="2" placeholder="--" autocomplete="off" aria-label="시(0~23)"><span class="ndt-colon" aria-hidden="true">:</span>' +
      '<input class="ndt-m" inputmode="numeric" maxlength="2" placeholder="--" autocomplete="off" aria-label="분(0~59)"><span class="ndt-ampm" aria-hidden="true"></span>' +
      (o.optional ? '<button type="button" class="ndt-clear" aria-label="시간 지우기"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' : '') + '</div>' +
      '<div class="ndt-chips">' + presets.map(function(p){ return '<button type="button" class="ndt-chip" data-t="' + p + '">' + p + '</button>'; }).join('') + '</div>';
    var H = host.querySelector('.ndt-h'), M = host.querySelector('.ndt-m'), AP = host.querySelector('.ndt-ampm'), box = host.querySelector('.ndt-box');
    function val(){ return (o.get && o.get()) || ''; }
    function show(v){
      var p = /^(\d{1,2}):(\d{2})/.exec(v || '');
      H.value = p ? pad(+p[1]) : ''; M.value = p ? p[2] : '';
      paint(v);
    }
    function paint(v){
      var h = H.value === '' ? NaN : +H.value;
      AP.textContent = isNaN(h) ? '' : (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + '시' + (M.value && +M.value ? ' ' + (+M.value) + '분' : '');
      box.classList.toggle('empty', !v);
      host.querySelectorAll('.ndt-chip').forEach(function(c){ c.classList.toggle('on', c.dataset.t === v); c.setAttribute('aria-pressed', String(c.dataset.t === v)); });
    }
    function commit(final){
      var h = H.value.replace(/\D/g, ''), mm = M.value.replace(/\D/g, '');
      var v = '';
      if(h !== ''){ var hh = Math.min(23, +h), mi = mm === '' ? 0 : Math.min(59, +mm); v = pad(hh) + ':' + pad(mi); }
      else if(mm !== '' && !o.optional){ v = ''; }
      if(o.set) o.set(v);
      if(final) show(v); else paint(v);
    }
    function onInput(el, max, next){
      var s = el.value.replace(/\D/g, '').slice(0, 2);
      if(s.length === 1 && +s > max){ s = '0' + s; }   // 시 3~9 / 분 6~9 → 한 자리면 바로 다음 칸
      if(s.length === 2 && +s > (el === H ? 23 : 59)) s = String(el === H ? 23 : 59);
      el.value = s;
      commit(false);
      if(s.length === 2 && next){ next.focus(); next.select(); }
    }
    H.addEventListener('input', function(){ onInput(H, 2, M); });
    M.addEventListener('input', function(){ onInput(M, 5, null); });
    [H, M].forEach(function(el){
      el.addEventListener('focus', function(){ setTimeout(function(){ try { el.select(); } catch(e){} }, 0); });
      el.addEventListener('keydown', function(e){
        if(e.isComposing || e.key === 'Process') return;
        if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
          e.preventDefault();
          var up = e.key === 'ArrowUp';
          if(el === H){ var h = H.value === '' ? (up ? 8 : 18) : +H.value; h = (h + (up ? 1 : -1) + 24) % 24; H.value = pad(h); if(M.value === '') M.value = '00'; }
          else { var mi = M.value === '' ? 0 : +M.value; mi = up ? (Math.floor(mi / 5) * 5 + 5) % 60 : (Math.ceil(mi / 5) * 5 - 5 + 60) % 60; M.value = pad(mi); if(H.value === '') H.value = '09'; }
          commit(false); el.select(); return;
        }
        if(el === H && (e.key === ':' || e.key === '.' || e.key === ' ')){ e.preventDefault(); M.focus(); return; }
        if(el === M && e.key === 'Backspace' && M.value === ''){ e.preventDefault(); H.focus(); return; }
        if(el === M && e.key === 'ArrowLeft' && M.selectionStart === 0 && M.selectionEnd === 0){ e.preventDefault(); H.focus(); return; }
        if(el === H && e.key === 'ArrowRight' && H.selectionStart === H.value.length){ e.preventDefault(); M.focus(); return; }
        if(e.key === 'Enter'){ e.preventDefault(); commit(true); }
      });
    });
    host.addEventListener('focusout', function(e){ if(!host.contains(e.relatedTarget)) commit(true); });
    box.addEventListener('mousedown', function(e){ if(e.target === box || e.target.classList.contains('ndt-colon') || e.target === AP){ e.preventDefault(); (H.value === '' ? H : M).focus(); } });
    host.addEventListener('click', function(e){
      var c = e.target.closest('.ndt-chip'); if(c){ if(o.set) o.set(c.dataset.t); show(c.dataset.t); return; }
      if(e.target.closest('.ndt-clear')){ if(o.set) o.set(''); show(''); H.focus(); }
    });
    var api = { opts: function(n){ o = n || o; }, sync: function(){ show(val()); } };
    host._ndTime = api; show(val());
    return api;
  };

  // ===== 메뉴 전환 모핑: 내용이 블러·투명하게 사라짐 → 카드가 새 크기로 슈욱 → 새 내용이 블러에서 또렷하게 =====
  // ndMorph(card, swap, {parts}) : swap()이 내용을 바꿈(동기). parts() = 흐려졌다 나타날 요소들(기본: card의 자식 전부)
  // 카드의 원래 인라인 width/height는 끝나면 그대로 되돌림. 동작 줄이기 설정·애니메이션 미지원이면 바로 바꿈
  var EASE = 'cubic-bezier(.22,1,.36,1)';
  window.ndMorph = function(card, swap, opt){
    opt = opt || {};
    var parts = function(){ var p = opt.parts ? opt.parts() : Array.prototype.slice.call(card.children); return p.filter(function(e){ return e && e.getClientRects().length; }); };
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(card && card._ndMorph) card._ndMorph();   // 앞 전환이 진행 중이면 즉시 끝내고 새로 시작
    if(!card || !card.isConnected || calm || !card.animate || document.hidden){ swap(); return; }
    var alive = true, anims = [], saved = {}, timers = [];
    ['width', 'height', 'transition', 'overflow'].forEach(function(k){ saved[k] = [card.style.getPropertyValue(k), card.style.getPropertyPriority(k)]; });
    function restore(){ Object.keys(saved).forEach(function(k){ card.style.removeProperty(k); if(saved[k][0]) card.style.setProperty(k, saved[k][0], saved[k][1]); }); }
    function finish(){ if(!alive) return; alive = false; timers.forEach(clearTimeout); anims.forEach(function(a){ try { a.cancel(); } catch(e){} }); restore(); card._ndMorph = null; }
    card._ndMorph = function(){ var was = alive; finish(); if(was && !swapped){ swapped = true; swap(); } };
    var swapped = false, r0 = card.getBoundingClientRect(), out = parts();
    var BLUR = 'blur(8px)';
    out.forEach(function(e){ anims.push(e.animate([{ opacity: 1, filter: 'blur(0)', transform: 'none' }, { opacity: 0, filter: BLUR, transform: 'scale(.985)' }], { duration: 150, easing: 'ease-in', fill: 'forwards' })); });
    timers.push(setTimeout(function(){
      if(!alive) return;
      anims.forEach(function(a){ try { a.cancel(); } catch(e){} }); anims = [];
      swapped = true; swap();
      var inn = parts();
      inn.forEach(function(e){ anims.push(e.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' })); });   // 크기 바뀌는 동안 새 내용은 숨김
      var r1 = card.getBoundingClientRect(), grow = Math.abs(r1.width - r0.width) > 1 || Math.abs(r1.height - r0.height) > 1;
      var D = grow ? 360 : 0;
      if(grow){
        card.style.setProperty('overflow', 'hidden', 'important');
        card.style.setProperty('width', r0.width + 'px', 'important'); card.style.setProperty('height', r0.height + 'px', 'important');
        void card.offsetWidth;
        card.style.setProperty('transition', 'width ' + D + 'ms ' + EASE + ', height ' + D + 'ms ' + EASE, 'important');
        card.style.setProperty('width', r1.width + 'px', 'important'); card.style.setProperty('height', r1.height + 'px', 'important');
      }
      timers.push(setTimeout(function(){
        if(!alive) return;
        restore();
        anims.forEach(function(a){ try { a.cancel(); } catch(e){} }); anims = [];
        var last = null;
        inn.forEach(function(e, i){ last = e.animate([{ opacity: 0, filter: BLUR, transform: 'scale(.985)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 300, delay: i * 50, easing: EASE, fill: 'backwards' }); anims.push(last); });
        if(last) last.onfinish = finish; else finish();
        timers.push(setTimeout(finish, 300 + inn.length * 50 + 200));
      }, grow ? D - 60 : 0));
    }, 150));
  };

  // ===== 기존 input에 붙이기(값은 input에 그대로 → 저장 코드 손대지 않음) =====
  function fire(input){ try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){} }
  window.ndDateInput = function(input, host, extra){
    if(!input || !host) return null;
    input.classList.add('nd-native-src');
    var o = Object.assign({ get: function(){ return input.value; }, set: function(v){ input.value = v; fire(input); } }, extra || {});
    var api = ndCal(host, o);
    if(!input._ndcBound){ input._ndcBound = 1; input.addEventListener('change', function(){ if(host._ndCal && document.activeElement === input) host._ndCal.sync(); }); }
    return api;
  };
  window.ndTimeInput = function(input, host, extra){
    if(!input || !host) return null;
    input.classList.add('nd-native-src');
    var o = Object.assign({ get: function(){ return input.value; }, set: function(v){ input.value = v; fire(input); }, optional: true }, extra || {});
    return ndTime(host, o);
  };
})();
