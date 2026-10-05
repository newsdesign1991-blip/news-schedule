/* [모듈] js/nd-select.js — 넓은 화면(≥1001px·마우스) 드롭다운을 앱 스타일 목록으로 | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// 원래 <select>가 값의 주인: 목록에서 고르면 select 값을 바꾸고 input/change 이벤트를 보내 기존 onchange가 그대로 동작.
// 모바일·터치·multiple·size>1·disabled·data-native-select 안의 select는 시스템 목록 그대로. 스타일은 css/nd-select.css.
(function(){
  var MQ = window.matchMedia ? matchMedia('(min-width:1001px) and (pointer:fine)') : null;
  var pop = null, cur = null, hl = -1, typed = '', typedAt = 0, seq = 0;
  var CHECK = '<svg class="nds-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function usable(sel){
    return !!(MQ && MQ.matches && sel && sel.tagName === 'SELECT' && !sel.multiple && !(sel.size > 1) && !sel.disabled && !sel.closest('[data-native-select]'));
  }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function itemsEl(){ return pop ? pop.querySelectorAll('.nds-item') : []; }
  function setHl(i, scroll){
    var list = itemsEl(); if(!list.length) return;
    i = Math.max(0, Math.min(list.length - 1, i));
    if(hl >= 0 && list[hl]) list[hl].classList.remove('hl');
    hl = i; list[i].classList.add('hl');
    if(cur) cur.setAttribute('aria-activedescendant', list[i].id);
    if(scroll) list[i].scrollIntoView({block:'nearest'});
  }
  function move(d){   // 사용 가능한(비활성 아님) 항목으로만 이동
    var list = itemsEl(), i = hl;
    for(var n = 0; n < list.length; n++){ i += d; if(i < 0 || i >= list.length) return; if(!list[i].classList.contains('dis')){ setHl(i, true); return; } }
  }
  function place(){
    if(!pop || !cur) return;
    if(!cur.isConnected || !cur.getClientRects().length){ close(false); return; }
    var r = cur.getBoundingClientRect(), gap = 6, vw = innerWidth, vh = innerHeight;
    var w = Math.max(r.width, 180); pop.style.minWidth = w + 'px'; pop.style.maxWidth = Math.max(w, Math.min(420, vw - 32)) + 'px';
    var below = vh - r.bottom - gap - 12, above = r.top - gap - 12;
    var natural = Math.min(pop.scrollHeight, 340), up = below < Math.min(natural, 220) && above > below;
    var maxH = Math.max(120, Math.min(340, up ? above : below));
    pop.style.maxHeight = maxH + 'px';
    var h = Math.min(natural, maxH), left = Math.min(Math.max(12, r.left), vw - pop.offsetWidth - 12);
    pop.style.left = left + 'px';
    pop.style.top = (up ? r.top - gap - h : r.bottom + gap) + 'px';
    pop.classList.toggle('up', up);
  }
  function open(sel){
    close(false);
    cur = sel; hl = -1;
    var id = 'nds' + (++seq), html = '', n = 0, sIdx = sel.selectedIndex;
    Array.prototype.forEach.call(sel.children, function(ch){
      if(ch.tagName === 'OPTGROUP'){
        html += '<div class="nds-group" role="presentation">' + esc(ch.label) + '</div>';
        Array.prototype.forEach.call(ch.children, function(o){ html += row(o); });
      } else if(ch.tagName === 'OPTION') html += row(ch);
    });
    function row(o){
      if(o.hidden || o.style.display === 'none') return '';
      var cls = 'nds-item' + (o.index === sIdx ? ' sel' : '') + (o.disabled ? ' dis' : '') + (o.value === '' ? ' ph' : '');
      return '<div class="' + cls + '" role="option" id="' + id + '-' + (n++) + '" data-i="' + o.index + '" aria-selected="' + (o.index === sIdx) + '"' + (o.disabled ? ' aria-disabled="true"' : '') + '><span>' + esc(o.text) + '</span>' + CHECK + '</div>';
    }
    pop = document.createElement('div');
    pop.className = 'nds-pop'; pop.setAttribute('role', 'listbox'); pop.id = id;
    var fs = parseFloat(getComputedStyle(sel).fontSize) || 14;
    pop.style.fontSize = Math.max(13, Math.min(15, fs)) + 'px';
    pop.innerHTML = html || '<div class="nds-empty">항목 없음</div>';
    document.body.appendChild(pop);
    sel.classList.add('nds-open'); sel.setAttribute('aria-expanded', 'true'); sel.setAttribute('aria-controls', id);
    place();
    var list = itemsEl(), start = 0;
    for(var i = 0; i < list.length; i++){ if(list[i].classList.contains('sel')){ start = i; break; } }
    if(list.length) setHl(start, true);
    pop.addEventListener('mousedown', function(e){ e.preventDefault(); e.stopPropagation(); });   // 포커스는 select에 그대로
    pop.addEventListener('click', function(e){
      e.stopPropagation();
      var it = e.target.closest('.nds-item'); if(!it || it.classList.contains('dis')) return;
      choose(+it.dataset.i);
    });
    pop.addEventListener('mousemove', function(e){
      var it = e.target.closest('.nds-item'); if(!it || it.classList.contains('dis')) return;
      var list = Array.prototype.slice.call(itemsEl()), i = list.indexOf(it); if(i !== hl) setHl(i, false);
    });
  }
  function close(focus){
    if(pop){ pop.remove(); pop = null; }
    if(cur){ cur.classList.remove('nds-open'); cur.setAttribute('aria-expanded', 'false'); cur.removeAttribute('aria-activedescendant'); if(focus) try{ cur.focus({preventScroll:true}); }catch(e){} }
    cur = null; hl = -1;
  }
  function choose(i){
    var sel = cur; if(!sel) return;
    var o = sel.options[i]; if(!o || o.disabled){ return; }
    close(true);
    if(sel.selectedIndex !== i){
      sel.selectedIndex = i;
      sel.dispatchEvent(new Event('input', {bubbles:true}));
      sel.dispatchEvent(new Event('change', {bubbles:true}));
    }
  }
  // 열기: 마우스 — 시스템 목록 대신(mousedown 기본동작 막기)
  document.addEventListener('mousedown', function(e){
    var sel = e.target && e.target.closest ? e.target.closest('select') : null;
    if(pop && !(sel && sel === cur) && !pop.contains(e.target)) close(false);   // 바깥 클릭 → 닫기
    if(!sel || e.button !== 0 || !usable(sel)) return;
    e.preventDefault();
    try{ sel.focus({preventScroll:true}); }catch(err){}
    if(cur === sel) close(true); else open(sel);
  }, true);
  // 키보드: 닫혀 있을 땐 Space/Enter/Alt+↓로 열기, 열려 있을 땐 목록 조작(시스템 동작·모달 단축키보다 먼저)
  window.addEventListener('keydown', function(e){
    if(!pop || !cur){
      var sel = e.target;
      if(sel && sel.tagName === 'SELECT' && usable(sel) && (e.key === ' ' || e.key === 'Enter' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')))){ e.preventDefault(); open(sel); }
      return;
    }
    var k = e.key;
    if(k === 'Tab'){ close(false); return; }
    if(k === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(true); return; }
    if(k === 'ArrowDown' || k === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); move(k === 'ArrowDown' ? 1 : -1); return; }
    if(k === 'Home' || k === 'End'){ e.preventDefault(); e.stopPropagation(); var L = itemsEl(); setHl(k === 'Home' ? 0 : L.length - 1, true); if(L[hl] && L[hl].classList.contains('dis')) move(k === 'Home' ? 1 : -1); return; }
    if(k === 'PageDown' || k === 'PageUp'){ e.preventDefault(); e.stopPropagation(); for(var p = 0; p < 6; p++) move(k === 'PageDown' ? 1 : -1); return; }
    if(k === 'Enter' || k === ' '){ e.preventDefault(); e.stopPropagation(); var it = itemsEl()[hl]; if(it && !it.classList.contains('dis')) choose(+it.dataset.i); return; }
    if(k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){   // 글자 입력으로 찾기
      e.preventDefault(); e.stopPropagation();
      var now = Date.now(); typed = (now - typedAt > 700 ? '' : typed) + k.toLowerCase(); typedAt = now;
      var list = itemsEl();
      for(var j = 1; j <= list.length; j++){ var x = (hl + j) % list.length; if(!list[x].classList.contains('dis') && list[x].textContent.trim().toLowerCase().indexOf(typed) === 0){ setHl(x, true); return; } }
    }
  }, true);
  // 바깥 스크롤·창 크기 변경·넓은 화면 해제 → 닫기
  window.addEventListener('scroll', function(e){ if(pop && !(e.target === pop || pop.contains(e.target))) close(false); }, true);
  window.addEventListener('resize', function(){ close(false); });
  window.addEventListener('blur', function(){ close(false); });
  if(MQ){ if(MQ.addEventListener) MQ.addEventListener('change', function(){ close(false); }); else if(MQ.addListener) MQ.addListener(function(){ close(false); }); }
  window.ndSelectClose = close;
})();
