/* [모듈] js/nd-people.js — 사람 고르기 공통 부품(검색 + 추천 목록 + 고른 사람 태그) | 로드 순서 = dashboard.html의 <script> 순서(바꾸지 말 것) */
// 이름 칩을 눌러 고르던 곳을 대체: 이름·부서·초성(ㅊㅈㅇ)으로 찾고 ↑↓·Enter로 추가, 태그 ✕(또는 빈 칸에서 Backspace)로 빼기.
// ndPeoplePicker(host, {selected:[id], onChange(ids), staff:[직원], placeholder, color}) → {get(), set(ids), focus(), destroy()}
// 목록 모양은 앱 드롭다운(.nds-pop, css/nd-select.css)과 같음.
(function(){
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function chosung(s){ var o=''; for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i)-0xAC00; o += (c>=0 && c<11172) ? CHO[Math.floor(c/588)] : s[i]; } return o; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  var SEARCH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>';
  var X = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var openPicker = null;   // 한 번에 하나만 목록을 연다
  window.ndPeoplePicker = function(host, opt){
    opt = opt || {};
    var staff = (opt.staff || (typeof getStaff === 'function' ? getStaff() : [])).filter(Boolean);
    var byId = {}; staff.forEach(function(s){ byId[s.id] = s; });
    var sel = (opt.selected || []).filter(function(id){ return id; });
    var pop = null, hl = -1, list = [], uid = 'ndp' + Math.random().toString(36).slice(2, 8);
    host.innerHTML = '<div class="ndp"><div class="ndp-tags" aria-live="polite"></div><label class="ndp-box">' + SEARCH +
      '<input type="text" class="ndp-input" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="' + uid + '" placeholder="' + esc(opt.placeholder || '이름 검색해서 추가') + '"></label></div>';
    var tags = host.querySelector('.ndp-tags'), input = host.querySelector('.ndp-input');
    function name(id){ var s = byId[id] || (typeof staffById === 'function' ? staffById(id) : null); return s ? s.name : id; }
    function renderTags(){
      tags.innerHTML = sel.map(function(id){ var s = byId[id] || {}; return '<span class="ndp-tag" data-id="' + esc(id) + '">' + esc(name(id)) + (s.dept ? '<small>' + esc(s.dept) + '</small>' : '') +
        '<button type="button" class="ndp-x" aria-label="' + esc(name(id)) + ' 빼기">' + X + '</button></span>'; }).join('');
      tags.classList.toggle('empty', !sel.length);
    }
    function changed(){ renderTags(); if(opt.onChange) opt.onChange(sel.slice()); if(pop) build(); }
    function add(id){ if(!id || sel.indexOf(id) >= 0) return; sel.push(id); input.value = ''; changed(); }
    function remove(id){ var i = sel.indexOf(id); if(i < 0) return; sel.splice(i, 1); changed(); }
    function matches(){
      var q = input.value.trim().toLowerCase(), qc = chosung(q);
      return staff.filter(function(s){
        if(sel.indexOf(s.id) >= 0) return false;
        if(!q) return true;
        var n = (s.name || '').toLowerCase(), d = (s.dept || '').toLowerCase();
        return n.indexOf(q) >= 0 || d.indexOf(q) >= 0 || chosung(n).indexOf(qc) >= 0;
      });
    }
    function place(){
      if(!pop) return;
      if(!host.isConnected || !input.getClientRects().length){ closeList(); return; }
      var r = host.querySelector('.ndp-box').getBoundingClientRect(), vh = (window.visualViewport ? visualViewport.height : innerHeight), gap = 6;
      var below = vh - r.bottom - gap - 10, above = r.top - gap - 10, up = below < 200 && above > below;
      var maxH = Math.max(120, Math.min(300, up ? above : below));
      pop.style.minWidth = pop.style.maxWidth = r.width + 'px'; pop.style.left = r.left + 'px'; pop.style.maxHeight = maxH + 'px';
      var h = Math.min(pop.scrollHeight, maxH);
      pop.style.top = (up ? r.top - gap - h : r.bottom + gap) + 'px'; pop.classList.toggle('up', up);
    }
    function setHl(i, scroll){
      var items = pop ? pop.querySelectorAll('.nds-item') : []; if(!items.length){ hl = -1; return; }
      i = Math.max(0, Math.min(items.length - 1, i));
      if(items[hl]) items[hl].classList.remove('hl');
      hl = i; items[i].classList.add('hl'); input.setAttribute('aria-activedescendant', items[i].id);
      if(scroll) items[i].scrollIntoView({block:'nearest'});
    }
    function build(){
      list = matches();
      pop.innerHTML = list.length ? list.map(function(s, i){ return '<div class="nds-item" role="option" id="' + uid + '-' + i + '" data-id="' + esc(s.id) + '"><span>' + esc(s.name) + '</span><small class="ndp-dept">' + esc(s.dept || '') + '</small></div>'; }).join('')
        : '<div class="nds-empty">' + (input.value.trim() ? '찾는 이름이 없어요' : '모두 골랐어요') + '</div>';
      hl = -1; if(list.length) setHl(0, false);
      place();
    }
    function openList(){
      if(openPicker && openPicker !== api) openPicker.close();
      if(!pop){
        pop = document.createElement('div'); pop.className = 'nds-pop ndp-pop'; pop.id = uid; pop.setAttribute('role', 'listbox');
        document.body.appendChild(pop);
        pop.addEventListener('mousedown', function(e){ e.preventDefault(); e.stopPropagation(); });
        pop.addEventListener('click', function(e){ e.stopPropagation(); var it = e.target.closest('.nds-item'); if(it){ add(it.dataset.id); input.focus(); } });
        pop.addEventListener('mousemove', function(e){ var it = e.target.closest('.nds-item'); if(!it) return; var items = Array.prototype.slice.call(pop.querySelectorAll('.nds-item')), i = items.indexOf(it); if(i !== hl) setHl(i, false); });
        input.setAttribute('aria-expanded', 'true'); openPicker = api;
      }
      build();
    }
    function closeList(){ if(pop){ pop.remove(); pop = null; } hl = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); if(openPicker === api) openPicker = null; }
    tags.addEventListener('click', function(e){ var b = e.target.closest('.ndp-x'); if(b){ e.stopPropagation(); remove(b.parentNode.dataset.id); input.focus(); } });
    input.addEventListener('focus', openList);
    input.addEventListener('input', openList);
    input.addEventListener('blur', function(){ setTimeout(function(){ if(document.activeElement !== input) closeList(); }, 120); });
    input.addEventListener('keydown', function(e){
      var k = e.key;
      if(e.isComposing || k === 'Process') return;   // 한글 조합 중엔 건드리지 않음
      if(k === 'ArrowDown' || k === 'ArrowUp'){ e.preventDefault(); if(!pop) openList(); else setHl(hl + (k === 'ArrowDown' ? 1 : -1), true); return; }
      if(k === 'Enter'){ e.preventDefault(); e.stopPropagation(); if(pop && hl >= 0 && list[hl]) add(list[hl].id); else if(!pop) openList(); return; }
      if(k === 'Escape'){ if(pop){ e.preventDefault(); e.stopPropagation(); closeList(); } return; }
      if(k === 'Backspace' && !input.value && sel.length){ remove(sel[sel.length - 1]); return; }
      if(k === 'Tab') closeList();
    });
    var onScroll = function(e){ if(pop && !(e.target === pop || pop.contains(e.target))) place(); };
    var onResize = function(){ if(pop) place(); };
    window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onResize);
    if(window.visualViewport) visualViewport.addEventListener('resize', onResize);
    var api = {
      get: function(){ return sel.slice(); },
      set: function(ids){ sel = (ids || []).filter(Boolean); renderTags(); if(pop) build(); },
      focus: function(){ input.focus(); },
      close: closeList,
      destroy: function(){ closeList(); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize); if(window.visualViewport) visualViewport.removeEventListener('resize', onResize); }
    };
    renderTags();
    host._ndPicker = api;
    return api;
  };
})();
