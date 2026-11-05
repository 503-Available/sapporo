/* =========================================================
   삿포로 가족여행 2026 — 동작 로직
   데이터(trip.json)를 읽어 화면을 그립니다.
   체크 상태는 각자 휴대폰(localStorage)에만 저장합니다. (D5)
   ========================================================= */
(function () {
  'use strict';

  // ---------- 1. 상태 ----------
  var trip = null;            // trip.json 내용
  var placeById = {};         // 장소 ID → 장소 (빠른 조회용)
  var state = { tab: 'schedule', dayIndex: 0 };
  var view = document.getElementById('view');

  // ---------- 2. 휴대폰 저장소 (실패해도 앱은 동작) ----------
  var STORE_KEY = 'sapporo2026:';
  function load(key, fallback) {
    try {
      var v = localStorage.getItem(STORE_KEY + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(STORE_KEY + key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ }
  }

  // ---------- 3. 유틸 ----------
  // 데이터의 글자를 화면에 안전하게 넣기 (HTML 주입 방지)
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // 테스트용: 주소 뒤에 ?date=2026-11-21&time=12:40 을 붙이면 그 시각인 것처럼 동작
  var params = new URLSearchParams(location.search);
  var TEST_DATE = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : null;
  var TEST_TIME = /^\d{2}:\d{2}$/.test(params.get('time') || '') ? params.get('time') : null;
  function todayStr() {
    if (TEST_DATE) return TEST_DATE;
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowHHMM() {
    if (TEST_TIME) return TEST_TIME;
    var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dateLabel(iso) {
    var p = iso.split('-');
    var dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(+p[0], +p[1] - 1, +p[2]).getDay()];
    return (+p[1]) + '/' + (+p[2]) + '(' + dow + ')';
  }
  function daysUntil(iso) {
    var p = iso.split('-'), q = todayStr().split('-');
    var target = new Date(+p[0], +p[1] - 1, +p[2]);
    var today = new Date(+q[0], +q[1] - 1, +q[2]);
    return Math.round((target - today) / 86400000);
  }
  // 구글맵 검색 링크 (G4: API 키 없이 링크만)
  function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  // 일본 번호 → 국제 형식 (로밍 휴대폰에서도 걸리도록)
  function telUrl(tel) { return 'tel:+81' + tel.replace(/[^0-9]/g, '').replace(/^0/, ''); }

  var TYPE_ICON = { flight: '✈️', move: '🚃', hotel: '🏨', food: '🍽️', sight: '🗼', shop: '🛍️', tour: '🚌' };
  var CAT_ICON = { food: '🍽️', sight: '🗼', shop: '🛍️', hotel: '🏨', transport: '✈️' };
  var RESV_LABEL = { required: '🔴 예약 필수', recommended: '🟡 예약 권장', done: '✅ 예약 완료' };

  function badge(r) { return r ? '<span class="badge ' + esc(r) + '">' + esc(RESV_LABEL[r] || r) + '</span>' : ''; }

  // ---------- 4. 데이터 불러오기 ----------
  function init() {
    fetch('data/trip.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        trip = data;
        trip.places.forEach(function (p) { placeById[p.id] = p; });
        // 여행 중이면 오늘 날짜를 자동 선택
        var t = todayStr();
        var idx = trip.days.findIndex(function (d) { return d.date === t; });
        state.dayIndex = idx >= 0 ? idx : load('dayIndex', 0);
        if (!trip.days[state.dayIndex]) state.dayIndex = 0;
        var hashTab = location.hash.slice(1);
        var TABS = ['schedule', 'food', 'sight', 'shop', 'reserve', 'subway'];
        state.tab = TABS.indexOf(hashTab) >= 0 ? hashTab : load('tab', 'schedule');
        renderHeader();
        render();
        // 테스트용: ?place=youkobo 를 붙이면 해당 장소 상세 창을 바로 열기
        if (params.get('place')) openPlace(params.get('place'));
        // 앱을 켜 둔 채로 시간이 지나면 '지금' 카드를 갱신
        setInterval(function () { if (state.tab === 'schedule') render(); }, 60000);
      })
      .catch(function () {
        view.innerHTML = '<p class="loading">데이터를 불러오지 못했어요.<br>인터넷 연결 후 다시 열어 주세요.</p>';
      });
  }

  function renderHeader() {
    document.getElementById('app-title').textContent = '❄ ' + trip.title;
    var d = daysUntil(trip.startDate);
    var sub = d > 0 ? '출발까지 D-' + d
      : daysUntil(trip.endDate) >= 0 ? '여행 중! 즐거운 하루 되세요 ⛄'
      : '즐거웠던 삿포로 여행 🎉';
    document.getElementById('app-subtitle').textContent = trip.subtitle + ' · ' + sub;
  }

  // ---------- 5. 화면 전환 ----------
  function render() {
    document.querySelectorAll('.tabbar button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === state.tab);
    });
    var html = {
      schedule: renderSchedule, food: renderFood, sight: renderSight,
      shop: renderShop, reserve: renderReserve, subway: renderSubway
    }[state.tab]();
    view.innerHTML = html;
  }

  // ---------- 6. 📅 일정 (FR-01) ----------
  function renderSchedule() {
    var day = trip.days[state.dayIndex];
    var isToday = day.date === todayStr();
    var now = nowHHMM();

    var tabs = '<div class="day-tabs" role="tablist">' + trip.days.map(function (d, i) {
      return '<button role="tab" data-day="' + i + '" class="' + (i === state.dayIndex ? 'active' : '') + '">' +
        '<b>' + esc(d.label) + '</b><small>' + esc(dateLabel(d.date)) + '</small></button>';
    }).join('') + '</div>';

    // 지금 / 다음 일정 찾기
    var curIdx = -1;
    if (isToday) day.items.forEach(function (it, i) { if (it.time <= now) curIdx = i; });

    var top = '';
    if (isToday) {
      var cur = day.items[curIdx], next = day.items[curIdx + 1];
      top = '<div class="now-card">' +
        (cur ? '<div class="label">▶ 지금 · ' + esc(cur.time) + '</div><div class="title">' +
          (TYPE_ICON[cur.type] || '') + ' ' + esc(cur.title) + badge(cur.reservation) + '</div>'
          : '<div class="label">오늘의 첫 일정</div>') +
        (next ? '<div class="next">다음 ' + esc(next.time) + ' · ' + (TYPE_ICON[next.type] || '') + ' ' + esc(next.title) + '</div>'
          : '<div class="next">오늘 일정 끝! 푹 쉬세요 🌙</div>') +
        '</div>';
    } else if (state.dayIndex === 0 && daysUntil(trip.startDate) > 0) {
      top = '<div class="card countdown"><b>D-' + daysUntil(trip.startDate) + '</b>' +
        '<span class="muted">' + esc(dateLabel(trip.startDate)) + ' 출발 · 준비됐나요?</span></div>';
    }

    var list = '<ul class="timeline">' + day.items.map(function (it, i) {
      var cls = [];
      if (it.placeId) cls.push('clickable');
      if (isToday && i === curIdx) cls.push('is-now');
      if (isToday && i < curIdx) cls.push('is-past');
      return '<li class="' + cls.join(' ') + '"' + (it.placeId ? ' data-place="' + esc(it.placeId) + '" tabindex="0"' : '') + '>' +
        '<span class="time">' + esc(it.time) + '</span>' +
        '<span class="ico">' + (TYPE_ICON[it.type] || '•') + '</span>' +
        '<span class="body"><span class="t">' + esc(it.title) + '</span>' + badge(it.reservation) +
        (it.note ? '<span class="n" style="display:block">' + esc(it.note) + '</span>' : '') + '</span>' +
        '<span class="chev">' + (it.placeId ? '›' : '') + '</span></li>';
    }).join('') + '</ul>';

    return tabs + '<div class="day-theme">' + esc(day.theme) + '</div>' + top + list;
  }

  // ---------- 7. 🍜 맛집 + 먹킷리스트 (FR-04) ----------
  function renderFood() {
    var checked = load('food', {});
    var done = trip.foodList.filter(function (f) { return checked[f.id]; }).length;
    var total = trip.foodList.length;
    var pct = Math.round(done / total * 100);

    var head = '<h2 class="section-title">먹킷리스트</h2>' +
      '<div class="progress-wrap"><div class="count">' + done + ' / ' + total + ' 완료' +
      (done === total ? ' 🎉 전부 먹었다!' : '') + '</div>' +
      '<div class="progress"><div style="width:' + pct + '%"></div></div></div>';

    var list = '<ul class="checklist">' + trip.foodList.map(function (f) {
      var on = !!checked[f.id];
      var where = (f.placeIds || []).map(function (pid) {
        var p = placeById[pid];
        return p ? '<button class="chip" data-place="' + esc(pid) + '">' + esc(shortName(p.name)) + ' ›</button>' : '';
      }).join(' ');
      return '<li class="' + (on ? 'checked' : '') + '">' +
        '<input type="checkbox" id="cb-' + esc(f.id) + '" data-check="food" data-id="' + esc(f.id) + '"' + (on ? ' checked' : '') + '>' +
        '<div class="body"><label for="cb-' + esc(f.id) + '"><span class="t">' + esc(f.emoji) + ' ' + esc(f.name) + '</span></label>' +
        '<div class="chips">' + where + '</div></div></li>';
    }).join('') + '</ul>';

    return head + list + '<h2 class="section-title">맛집 목록</h2>' + placeCards('food');
  }

  function shortName(n) { return n.replace(/\s*\(.*?\)\s*/g, '').split(' · ')[0]; }

  // ---------- 8. 🗼 관광 (FR-05) ----------
  function renderSight() {
    return '<h2 class="section-title">관광지</h2>' + placeCards('sight') +
      '<h2 class="section-title">쇼핑 명소</h2>' + placeCards('shop');
  }

  function placeCards(category) {
    return trip.places.filter(function (p) { return p.category === category; }).map(function (p) {
      return '<div class="card clickable" data-place="' + esc(p.id) + '" tabindex="0">' +
        '<div class="name">' + esc(p.name) + badge(p.reservation) + '</div>' +
        '<div class="ja">' + esc(p.nameJa || '') + (p.area ? ' · ' + esc(p.area) : '') + '</div>' +
        (p.hours ? '<div class="meta">⏰ ' + esc(p.hours) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  // ---------- 9. 🛍️ 쇼핑 리스트 (FR-06) ----------
  function renderShop() {
    var checked = load('shop', {});
    var done = trip.shoppingList.filter(function (s) { return checked[s.id]; }).length;
    var total = trip.shoppingList.length;

    var groups = {};
    trip.shoppingList.forEach(function (s) { (groups[s.category] = groups[s.category] || []).push(s); });

    var html = '<h2 class="section-title">쇼핑 리스트</h2>' +
      '<div class="progress-wrap"><div class="count">' + done + ' / ' + total + ' 구매</div>' +
      '<div class="progress"><div style="width:' + Math.round(done / total * 100) + '%"></div></div></div>';

    Object.keys(groups).forEach(function (cat) {
      html += '<h3 class="muted" style="margin:14px 0 6px">' + esc(cat) + '</h3><ul class="checklist">' +
        groups[cat].map(function (s) {
          var on = !!checked[s.id];
          return '<li class="' + (on ? 'checked' : '') + '">' +
            '<input type="checkbox" id="cb-' + esc(s.id) + '" data-check="shop" data-id="' + esc(s.id) + '"' + (on ? ' checked' : '') + '>' +
            '<label for="cb-' + esc(s.id) + '"><span class="t">' + esc(s.name) + '</span>' +
            '<span class="sub">📍 ' + esc(s.where) + (s.tip ? ' · ' + esc(s.tip) : '') + '</span></label></li>';
        }).join('') + '</ul>';
    });
    return html;
  }

  // ---------- 10. 📋 예약 (FR-03) ----------
  function renderReserve() {
    var order = { required: 0, recommended: 1, done: 2 };
    var list = trip.reservations.slice().sort(function (a, b) { return order[a.status] - order[b.status]; });
    var todo = list.filter(function (r) { return r.status !== 'done'; }).length;

    return '<h2 class="section-title">예약 현황</h2>' +
      '<p class="muted">' + (todo ? '아직 예약할 곳이 ' + todo + '곳 있어요.' : '모든 예약 완료! 👍') +
      ' 예약번호·바우처는 각자 휴대폰에 보관하세요.</p>' +
      list.map(function (r) {
        return '<div class="card resv-' + esc(r.status) + (r.placeId ? ' clickable" data-place="' + esc(r.placeId) + '" tabindex="0"' : '"') + '>' +
          '<div>' + badge(r.status) + '</div>' +
          '<div class="name" style="margin-top:4px">' + esc(r.title) + '</div>' +
          '<div class="meta">🗓 ' + esc(r.when) + '</div>' +
          (r.how ? '<div class="meta">📞 ' + esc(r.how) + '</div>' : '') +
          '</div>';
      }).join('');
  }

  // ---------- 10-1. 🚇 지하철 노선도 ----------
  // 여행에 필요한 역만 표시한 간략 노선도 (직접 그린 SVG)
  function subwayMap() {
    var c = {};
    trip.subway.lines.forEach(function (l) { c[l.id] = l.color; });
    function st(x, y, color, big) {
      return '<circle cx="' + x + '" cy="' + y + '" r="' + (big ? 8 : 5) + '" class="st" stroke="' + (color || 'currentColor') + '"/>';
    }
    function tx(x, y, s, anchor, cls) {
      return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'start') + '" class="' + (cls || '') + '">' + esc(s) + '</text>';
    }
    return '<svg class="subway-map" viewBox="0 0 340 385" role="img" aria-label="삿포로 지하철 간략 노선도">' +
      // 노선
      '<path d="M10 200 H330" stroke="' + c.T + '" stroke-width="7" fill="none"/>' +
      '<path d="M150 20 V365" stroke="' + c.N + '" stroke-width="7" fill="none"/>' +
      '<path d="M320 25 L290 40 L174 82 V365" stroke="' + c.H + '" stroke-width="7" fill="none" stroke-linejoin="round"/>' +
      // 역
      st(150, 50, c.N) + st(150, 270, c.N) + st(150, 330, c.N) +
      st(290, 40, c.H) + st(174, 280, c.H) + st(290, 200, c.T) +
      '<rect x="140" y="102" width="44" height="16" rx="8" class="st xfer"/>' +
      '<rect x="140" y="192" width="44" height="16" rx="8" class="st xfer"/>' +
      // 역 이름
      tx(150, 13, '↑ 麻生', 'middle', 'end') +
      tx(320, 18, '栄町 ↗', 'end', 'end') +
      tx(138, 54, '北12条', 'end') +
      tx(132, 114, 'さっぽろ', 'end', 'big') +
      tx(132, 188, '大通', 'end', 'big') +
      tx(138, 274, 'すすきの', 'end') +
      tx(138, 334, '中島公園', 'end') +
      tx(186, 284, '豊水すすきの') +
      tx(330, 64, '東区役所前', 'end') +
      tx(290, 188, 'バスセンター前', 'middle') +
      tx(12, 188, '← 宮の沢', 'start', 'end') +
      tx(330, 252, '新さっぽろ →', 'end', 'end') +
      tx(138, 378, '↓ 真駒内', 'end', 'end') +
      tx(186, 378, '↓ 福住', 'start', 'end') +
      // 여행 장소
      tx(192, 114, '🏨 호텔 · JR삿포로역', 'start', 'poi') +
      tx(138, 220, '🎄 오도리공원 · TV타워', 'end', 'poi') +
      tx(290, 220, '🐟 니조시장', 'middle', 'poi') +
      tx(138, 292, '🍛 스스키노 · 다누키코지', 'end', 'poi') +
      tx(330, 82, '🍺 맥주박물관', 'end', 'poi') +
      '</svg>';
  }

  function renderSubway() {
    var s = trip.subway;
    var legend = '<div class="legend">' + s.lines.map(function (l) {
      return '<span><i style="background:' + esc(l.color) + '"></i>' + esc(l.name) + ' ' + esc(l.nameJa) + '</span>';
    }).join('') + '</div>';

    var routes = s.routes.map(function (r) {
      return '<div class="card"><div class="name" style="font-size:17px">' + esc(r.from) + ' → ' + esc(r.to) + '</div>' +
        '<div class="meta" style="color:var(--text)">🚇 ' + esc(r.how) + '</div>' +
        (r.alt ? '<div class="meta">💡 ' + esc(r.alt) + '</div>' : '') + '</div>';
    }).join('');

    var lists = s.lines.map(function (l) {
      return '<details class="card"><summary><b style="color:' + esc(l.color) + '">●</b> ' + esc(l.name) + ' ' + esc(l.nameJa) +
        ' <span class="muted">(' + l.stations.length + '개 역)</span></summary><ol class="stations">' +
        l.stations.map(function (name, i) {
          return '<li><span class="no" style="background:' + esc(l.color) + '">' + esc(l.id) + pad(i + 1) + '</span>' + esc(name) + '</li>';
        }).join('') + '</ol></details>';
    }).join('');

    return '<h2 class="section-title">삿포로 지하철 (여행 구간)</h2>' + legend +
      '<div class="card map-card">' + subwayMap() + '</div>' +
      '<p class="muted">💴 ' + esc(s.fare) + '</p>' +
      '<h2 class="section-title">자주 쓰는 길</h2>' + routes +
      '<h2 class="section-title">전체 역 목록</h2>' + lists +
      '<h2 class="section-title">알아두면 좋아요</h2><ul class="tips">' +
      s.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<a class="btn" style="margin-top:12px" href="' + esc(s.officialUrl) + '" target="_blank" rel="noopener">🗺 공식 노선도·역 구내도 (삿포로시 교통국)</a>';
  }

  // ---------- 11. 장소 상세 창 (FR-02) ----------
  var sheet = document.getElementById('sheet');
  var backdrop = document.getElementById('sheet-backdrop');
  var lastFocus = null;

  function openPlace(id) {
    var p = placeById[id];
    if (!p) return;
    lastFocus = document.activeElement;
    var rows = [
      ['📍', p.address], ['⏰', p.hours], ['🚫', p.closed ? '휴무: ' + p.closed : ''],
      ['💴', p.price], ['☎️', p.tel]
    ].filter(function (r) { return r[1]; });

    sheet.innerHTML = '<div class="grabber"></div>' +
      '<h2>' + (CAT_ICON[p.category] || '') + ' ' + esc(p.name) + '</h2>' +
      '<div class="ja">' + esc(p.nameJa || '') + '</div>' +
      (p.reservation ? '<p style="margin:0 0 10px">' + badge(p.reservation) + '</p>' : '') +
      '<dl>' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      (p.tip ? '<div class="tip">💡 ' + esc(p.tip) + '</div>' : '') +
      '<div class="actions">' +
        '<a class="btn primary' + (p.tel ? '' : ' full') + '" href="' + esc(mapUrl(p.map || p.nameJa || p.name)) + '" target="_blank" rel="noopener">🗺 길찾기</a>' +
        (p.tel ? '<a class="btn" href="' + esc(telUrl(p.tel)) + '">📞 전화</a>' : '') +
      '</div>' +
      '<button class="btn close" data-close>닫기</button>';

    sheet.hidden = false; backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    sheet.querySelector('[data-close]').focus();
  }
  function closeSheet() {
    sheet.hidden = true; backdrop.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  // ---------- 12. 터치·클릭 처리 ----------
  document.querySelector('.tabbar').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab; save('tab', state.tab);
    render(); window.scrollTo(0, 0);
  });

  view.addEventListener('click', function (e) {
    var dayBtn = e.target.closest('[data-day]');
    if (dayBtn) { state.dayIndex = +dayBtn.dataset.day; save('dayIndex', state.dayIndex); render(); return; }
    if (e.target.closest('input, label')) return;
    var pl = e.target.closest('[data-place]');
    if (pl) openPlace(pl.dataset.place);
  });

  view.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-place][tabindex]')) {
      e.preventDefault(); openPlace(e.target.dataset.place);
    }
  });

  view.addEventListener('change', function (e) {
    var cb = e.target.closest('input[data-check]');
    if (!cb) return;
    var key = cb.dataset.check;
    var checked = load(key, {});
    if (cb.checked) checked[cb.dataset.id] = true; else delete checked[cb.dataset.id];
    save(key, checked);
    render();
  });

  backdrop.addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  // ---------- 13. 오프라인 지원 등록 (NFR-03) ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () { /* 무시 */ });
    });
  }

  init();
})();
