/* =========================================================
   삿포로 가족여행 2026 — 동작 로직 (디자인 v2)
   데이터(trip.json)를 읽어 화면을 그립니다.
   체크 상태는 각자 휴대폰(localStorage)에만 저장합니다. (D5)
   ========================================================= */
(function () {
  'use strict';

  // ---------- 1. 상태 ----------
  var trip = null;            // trip.json 내용
  var dataModified = '';      // trip.json 이 서버에 반영된 시각 (Last-Modified)
  var REPO = 'https://github.com/503-Available/sapporo';   // 관리자 메뉴용
  var placeById = {};
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

  // ---------- 3. 선 아이콘 (직접 그린 SVG, 오프라인에서도 표시) ----------
  var ICON = {
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    utensils: '<path d="M6 3v6a3 3 0 0 0 6 0V3M9 3v18M18 21V3c-2.5 1.2-4 3.6-4 6.5V14h4"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    bag: '<path d="M5 7h14l-1 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 7z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
    ticket: '<path d="M4 6h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7a1 1 0 0 1 1-1z"/><path d="M15 6v2M15 11v2M15 16v2"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="14" r=".8"/><circle cx="15" cy="14" r=".8"/>',
    plane: '<path d="M21 3 3 10.5l7 3 3 7L21 3z"/><path d="M10 13.5 21 3"/>',
    bed: '<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
    bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14.5" r=".8"/><circle cx="16" cy="14.5" r=".8"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    yen: '<path d="M7 4l5 7 5-7M12 11v9M8 13h8M8 16.5h8"/>',
    phone: '<path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    nav: '<path d="M3 11 21 3l-8 18-2-8-8-2z"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    pulse: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z"/><path d="M14 3v5h5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>'
  };
  function icon(name, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || '') + '</svg>';
  }
  var TYPE_ICON = { flight: 'plane', move: 'train', hotel: 'bed', food: 'utensils', sight: 'camera', shop: 'bag', tour: 'bus', transport: 'plane' };
  function tile(type) { return '<span class="tile t-' + type + '">' + icon(TYPE_ICON[type] || 'pin') + '</span>'; }

  // ---------- 4. 유틸 ----------
  // 화면에는 이모지를 빼고 표시 (심플 디자인) + HTML 주입 방지
  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FA}\u{FE0F}\u{200D}\u{20E3}]/gu;
  function esc(s) {
    return String(s == null ? '' : s).replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // 테스트용: ?date=2026-11-21&time=12:40 → 그 시각인 것처럼 동작
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
    return Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - new Date(+q[0], +q[1] - 1, +q[2])) / 86400000);
  }
  function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function telUrl(tel) { return 'tel:+81' + tel.replace(/[^0-9]/g, '').replace(/^0/, ''); }

  var RESV_LABEL = { required: '예약 필수', recommended: '예약 권장', done: '예약 완료' };
  function badge(r) { return r ? '<span class="badge ' + esc(r) + '">' + RESV_LABEL[r] + '</span>' : ''; }

  // ---------- 5. 데이터 불러오기 ----------
  function init() {
    fetch('data/trip.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        dataModified = r.headers.get('last-modified') || '';
        return r.json();
      })
      .then(function (data) {
        trip = data;
        trip.places.forEach(function (p) { placeById[p.id] = p; });
        var t = todayStr();
        var idx = trip.days.findIndex(function (d) { return d.date === t; });
        state.dayIndex = idx >= 0 ? idx : load('dayIndex', 0);
        if (!trip.days[state.dayIndex]) state.dayIndex = 0;
        var hashTab = location.hash.slice(1);
        var TABS = ['schedule', 'food', 'sight', 'shop', 'reserve', 'subway'];
        state.tab = TABS.indexOf(hashTab) >= 0 ? hashTab : load('tab', 'schedule');
        renderHeader();
        render();
        if (params.get('place')) openPlace(params.get('place'));
        if (params.get('admin') === '1') openAdmin();
        setInterval(function () { if (state.tab === 'schedule') render(); }, 60000);
      })
      .catch(function () {
        view.innerHTML = '<p class="loading">데이터를 불러오지 못했어요.<br>인터넷 연결 후 다시 열어 주세요.</p>';
      });
  }

  function renderHeader() {
    document.getElementById('app-title').textContent = trip.title;
    var s = trip.startDate.split('-'), e = trip.endDate.split('-');
    document.getElementById('app-subtitle').textContent =
      (+s[1]) + '.' + (+s[2]) + ' – ' + (+e[1]) + '.' + (+e[2]) + ' · ' + trip.subtitle;
    var d = daysUntil(trip.startDate);
    var dday = document.getElementById('dday');
    dday.textContent = d > 0 ? 'D-' + d : daysUntil(trip.endDate) >= 0 ? '여행 중' : '여행 끝';
    dday.hidden = false;
  }

  // ---------- 6. 화면 전환 ----------
  function render() {
    document.querySelectorAll('.tabbar button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === state.tab);
    });
    view.innerHTML = {
      schedule: renderSchedule, food: renderFood, sight: renderSight,
      shop: renderShop, reserve: renderReserve, subway: renderSubway
    }[state.tab]();
  }

  // 공통 목록 행
  function row(o) {
    return '<li class="row' + (o.cls ? ' ' + o.cls : '') + (o.place ? ' clickable" data-place="' + esc(o.place) + '" tabindex="0"' : '"') + '>' +
      (o.lead || '') +
      '<span class="body"><span class="t">' + o.title + '</span>' +
      (o.sub ? '<span class="n">' + o.sub + '</span>' : '') + (o.extra || '') + '</span>' +
      (o.place ? '<span class="chev">' + icon('chev', 'sm') + '</span>' : '') + '</li>';
  }

  // ---------- 7. 일정 (FR-01) ----------
  function renderSchedule() {
    var day = trip.days[state.dayIndex];
    var isToday = day.date === todayStr();
    var now = nowHHMM();

    var seg = '<div class="segment" role="tablist">' + trip.days.map(function (d, i) {
      return '<button role="tab" data-day="' + i + '" class="' + (i === state.dayIndex ? 'active' : '') + '">' +
        '<b>' + esc(d.label) + '</b><small>' + esc(dateLabel(d.date)) + '</small></button>';
    }).join('') + '</div>';

    var head = '<div class="day-head"><div class="date">' + esc(day.label) + ' · ' + esc(dateLabel(day.date)) + '</div>' +
      '<div class="theme">' + esc(day.theme) + '</div></div>';

    var curIdx = -1;
    if (isToday) day.items.forEach(function (it, i) { if (it.time <= now) curIdx = i; });

    var top = '';
    if (isToday) {
      var cur = day.items[curIdx], next = day.items[curIdx + 1];
      top = '<div class="now-card">' +
        '<div class="label"><span class="dot"></span>' + (cur ? '지금 · ' + esc(cur.time) : '오늘의 첫 일정') + '</div>' +
        (cur ? '<div class="title">' + esc(cur.title) + badge(cur.reservation) + '</div>' : '') +
        '<div class="next">' + (next ? '다음 ' + esc(next.time) + ' · ' + esc(next.title) : '오늘 일정 끝! 푹 쉬세요') + '</div>' +
        '</div>';
    } else if (state.dayIndex === 0 && daysUntil(trip.startDate) > 0) {
      top = '<div class="card countdown"><b>출발까지 ' + daysUntil(trip.startDate) + '일</b>' +
        '<span class="muted">' + esc(dateLabel(trip.startDate)) + ' 인천 12:55 출발</span></div>';
    }

    var list = '<ul class="list timeline">' + day.items.map(function (it, i) {
      var cls = [];
      if (isToday && i === curIdx) cls.push('is-now');
      if (isToday && i < curIdx) cls.push('is-past');
      return row({
        cls: cls.join(' '), place: it.placeId,
        lead: '<span class="time">' + esc(it.time) + '</span>' + tile(it.type),
        title: esc(it.title), sub: it.note ? esc(it.note) : '', extra: badge(it.reservation)
      });
    }).join('') + '</ul>';

    return seg + head + top + list;
  }

  // ---------- 8. 맛집 (FR-04) ----------
  // 맛집 탭: 일정 순서대로 날짜별 맛집 목록 (가게 + 먹을 음식)
  function renderFood() {
    var seen = {};
    return trip.days.map(function (d) {
      var rows = d.items.filter(function (it) {
        var p = placeById[it.placeId];
        return p && p.category === 'food' && !seen[p.id] && (seen[p.id] = true);
      }).map(function (it) {
        var p = placeById[it.placeId];
        var foods = trip.foodList.filter(function (f) { return (f.placeIds || []).indexOf(p.id) >= 0; })
          .map(function (f) { return f.name; });
        var what = foods.length ? foods.join(', ') : it.title.replace(/^[^:]*:\s*/, '');
        return row({
          place: p.id, lead: '<span class="time">' + esc(it.time) + '</span>' + tile('food'),
          title: esc(p.name), sub: esc(what + (p.price ? ' · ' + p.price : '')), extra: badge(p.reservation)
        });
      });
      return rows.length ? '<h2 class="section-title">' + esc(d.label) + ' · ' + esc(dateLabel(d.date)) + '</h2>' +
        '<ul class="list timeline">' + rows.join('') + '</ul>' : '';
    }).join('');
  }

  // ---------- 9. 관광 (FR-05) ----------
  function isTourStop(p) { return /투어/.test(p.area || ''); }
  function renderSight() {
    return '<h2 class="section-title">관광지</h2>' + placeList(function (p) { return p.category === 'sight' && !isTourStop(p); }) +
      '<h2 class="section-title">비에이 투어 (Day 3)</h2>' + placeList(isTourStop);
  }
  function placeList(filter) {
    return '<ul class="list">' + trip.places.filter(filter).map(function (p) {
      return row({
        place: p.id, lead: tile(p.category), title: esc(p.name),
        sub: esc([p.area, p.hours].filter(Boolean).join(' · ')), extra: badge(p.reservation)
      });
    }).join('') + '</ul>';
  }

  // ---------- 10. 쇼핑 (FR-06): 쇼핑 장소 + 추천 기념품 ----------
  function renderShop() {
    var groups = {};
    trip.shoppingList.forEach(function (s) { (groups[s.category] = groups[s.category] || []).push(s); });
    var html = '<h2 class="section-title">쇼핑 장소</h2>' + placeList(function (p) { return p.category === 'shop'; });
    Object.keys(groups).forEach(function (cat) {
      html += '<h2 class="section-title">추천 · ' + esc(cat) + '</h2><ul class="list">' +
        groups[cat].map(function (s) {
          return row({ cls: 'no-tile', title: esc(s.name), sub: esc(s.where + (s.tip ? ' · ' + s.tip : '')) });
        }).join('') + '</ul>';
    });
    return html;
  }

  // ---------- 11. 예약 (FR-03) ----------
  function renderReserve() {
    var order = { required: 0, recommended: 1, done: 2 };
    var list = trip.reservations.slice().sort(function (a, b) { return order[a.status] - order[b.status]; });
    var todo = list.filter(function (r) { return r.status !== 'done'; }).length;
    return '<h2 class="section-title">예약 현황</h2>' +
      '<div class="card"><b>' + (todo ? '예약할 곳 ' + todo + '곳 남았어요' : '모든 예약 완료!') + '</b>' +
      '<div class="muted">예약번호·바우처는 각자 휴대폰에 보관하세요.</div></div>' +
      '<ul class="list">' + list.map(function (r) {
        var p = placeById[r.placeId];
        return row({
          place: r.placeId, lead: tile(p ? p.category : 'transport'), title: esc(r.title),
          sub: esc(r.when + (r.how ? ' · ' + r.how : '')), extra: badge(r.status)
        });
      }).join('') + '</ul>';
  }

  // ---------- 12. 지하철 ----------
  function subwayMap() {
    var c = {};
    trip.subway.lines.forEach(function (l) { c[l.id] = l.color; });
    function st(x, y, color) { return '<circle cx="' + x + '" cy="' + y + '" r="5" class="st" stroke="' + color + '"/>'; }
    function tx(x, y, s, anchor, cls) {
      return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'start') + '" class="' + (cls || '') + '">' + esc(s) + '</text>';
    }
    return '<svg class="subway-map" viewBox="0 0 340 385" role="img" aria-label="삿포로 지하철 간략 노선도">' +
      '<path d="M10 200 H330" stroke="' + c.T + '" stroke-width="7" fill="none"/>' +
      '<path d="M150 20 V365" stroke="' + c.N + '" stroke-width="7" fill="none"/>' +
      '<path d="M320 25 L290 40 L174 82 V365" stroke="' + c.H + '" stroke-width="7" fill="none" stroke-linejoin="round"/>' +
      st(150, 50, c.N) + st(150, 270, c.N) + st(150, 330, c.N) + st(290, 40, c.H) + st(174, 280, c.H) + st(290, 200, c.T) +
      '<rect x="140" y="102" width="44" height="16" rx="8" class="st xfer"/>' +
      '<rect x="140" y="192" width="44" height="16" rx="8" class="st xfer"/>' +
      tx(150, 13, '↑ 아사부', 'middle', 'end') + tx(332, 12, '사카에마치 ↗', 'end', 'end') +
      tx(138, 54, '기타12조', 'end') + tx(132, 114, '삿포로', 'end', 'big') + tx(132, 188, '오도리', 'end', 'big') +
      tx(138, 274, '스스키노', 'end') + tx(138, 334, '나카지마코엔', 'end') + tx(186, 284, '호스이스스키노') +
      tx(282, 32, '히가시쿠야쿠쇼마에', 'end') + tx(290, 188, '버스센터마에', 'middle') +
      tx(12, 188, '← 미야노사와', 'start', 'end') + tx(330, 252, '신삿포로 →', 'end', 'end') +
      tx(138, 378, '↓ 마코마나이', 'end', 'end') + tx(186, 378, '↓ 후쿠즈미', 'start', 'end') +
      tx(192, 114, '● 호텔 · JR삿포로역', 'start', 'poi') + tx(138, 220, '오도리공원 · TV타워 ●', 'end', 'poi') +
      tx(290, 220, '● 니조시장', 'middle', 'poi') + tx(138, 292, '스스키노 · 다누키코지 ●', 'end', 'poi') +
      tx(330, 82, '● 맥주박물관', 'end', 'poi') +
      '</svg>';
  }

  function renderSubway() {
    var s = trip.subway;
    var legend = '<div class="legend">' + s.lines.map(function (l) {
      return '<span><i style="background:' + esc(l.color) + '"></i>' + esc(l.name) + '</span>';
    }).join('') + '</div>';
    var routes = '<ul class="list">' + s.routes.map(function (r) {
      return '<li class="row route">' + tile('move') + '<span class="body">' +
        '<span class="t">' + esc(r.from) + icon('arrow') + esc(r.to) + '</span>' +
        '<span class="n" style="color:var(--text)">' + esc(r.how) + '</span>' +
        (r.alt ? '<span class="n">' + esc(r.alt) + '</span>' : '') + '</span></li>';
    }).join('') + '</ul>';
    var lists = s.lines.map(function (l) {
      return '<details class="card"><summary><span class="dot" style="background:' + esc(l.color) + '"></span>' +
        esc(l.name) + ' <span class="muted">' + l.stations.length + '개 역</span>' +
        '<span class="chev">' + icon('chev', 'sm') + '</span></summary><ol class="stations">' +
        l.stations.map(function (name, i) {
          return '<li><span class="no" style="background:' + esc(l.color) + '">' + esc(l.id) + pad(i + 1) + '</span>' + esc(name) + '</li>';
        }).join('') + '</ol></details>';
    }).join('');

    return '<h2 class="section-title">삿포로 지하철 · 여행 구간</h2>' + legend +
      '<div class="card map-card">' + subwayMap() + '</div>' +
      '<p class="muted" style="margin:0 4px">' + esc(s.fare) + '</p>' +
      '<h2 class="section-title">자주 쓰는 길</h2>' + routes +
      '<h2 class="section-title">전체 역 목록</h2>' + lists +
      '<h2 class="section-title">알아두면 좋아요</h2><div class="card"><ul class="tips-list">' +
      s.tips.map(function (t) { return '<li>' + icon('check') + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div>' +
      '<a class="btn" href="' + esc(s.officialUrl) + '" target="_blank" rel="noopener">' + icon('external') + '공식 노선도 · 역 구내도</a>';
  }

  // ---------- 13. 장소 상세 창 (FR-02) ----------
  var sheet = document.getElementById('sheet');
  var backdrop = document.getElementById('sheet-backdrop');
  var lastFocus = null;

  function openPlace(id) {
    var p = placeById[id];
    if (!p) return;
    lastFocus = document.activeElement;
    var rows = [
      ['pin', p.address], ['clock', p.hours], ['ban', p.closed ? '휴무 ' + p.closed : ''],
      ['yen', p.price], ['phone', p.tel]
    ].filter(function (r) { return r[1]; });

    sheet.innerHTML = '<div class="grabber"></div>' +
      '<div class="sheet-head">' + tile(p.category) + '<div><h2>' + esc(p.name) + '</h2>' +
      (p.nameJa ? '<div class="ja">현지 표기 · ' + esc(p.nameJa) + '</div>' : '') + '</div></div>' + badge(p.reservation) +
      '<ul class="info">' + rows.map(function (r) { return '<li>' + icon(r[0]) + '<span>' + esc(r[1]) + '</span></li>'; }).join('') + '</ul>' +
      (p.tip ? '<div class="tip">' + icon('bulb') + '<span>' + esc(p.tip) + '</span></div>' : '') +
      '<div class="actions">' +
        '<a class="btn primary' + (p.tel ? '' : ' full') + '" href="' + esc(mapUrl(p.map || p.nameJa || p.name)) + '" target="_blank" rel="noopener">' + icon('nav') + '길찾기</a>' +
        (p.tel ? '<a class="btn" href="' + esc(telUrl(p.tel)) + '">' + icon('phone') + '전화</a>' : '') +
      '</div>' +
      '<button class="btn close" data-close>닫기</button>';
    showSheet();
  }
  function showSheet() {
    sheet.hidden = false; backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    sheet.querySelector('[data-close]').focus();
  }
  function closeSheet() {
    sheet.hidden = true; backdrop.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  // ---------- 14. 숨은 관리자 메뉴 (제목 5번 탭) ----------
  // 수정은 GitHub 로그인이 필요하므로 링크가 보여도 다른 사람은 고칠 수 없습니다.
  function openAdmin() {
    lastFocus = document.activeElement;
    var when = '알 수 없음';
    if (dataModified) {
      var d = new Date(dataModified);
      if (!isNaN(d)) when = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
    sheet.innerHTML = '<div class="grabber"></div>' +
      '<div class="sheet-head"><span class="tile t-move">' + icon('edit') + '</span><div><h2>관리자 메뉴</h2>' +
      '<div class="ja">아빠 전용 · 일정 데이터 수정</div></div></div>' +
      '<ul class="info"><li>' + icon('clock') + '<span>지금 보는 데이터: <b>' + esc(when) + '</b> 배포본</span></li></ul>' +
      '<div class="actions">' +
        '<a class="btn primary full" href="' + REPO + '/edit/main/data/trip.json" target="_blank" rel="noopener">' + icon('edit') + '일정 데이터 수정하기</a>' +
        '<a class="btn" href="' + REPO + '/actions" target="_blank" rel="noopener">' + icon('pulse') + '배포 상태</a>' +
        '<a class="btn" href="' + REPO + '/blob/main/data/trip.json" target="_blank" rel="noopener">' + icon('file') + '데이터 보기</a>' +
        '<button class="btn full" data-reload>' + icon('refresh') + '최신 버전으로 다시 열기</button>' +
      '</div>' +
      '<div class="tip">' + icon('bulb') + '<span><b>수정 요령</b><br>' +
        '· 글자만 바꾸고 따옴표(") · 쉼표(,) · 괄호는 지우지 마세요<br>' +
        '· 시간은 "09:30"처럼 두 자리:두 자리<br>' +
        '· 저장: 오른쪽 위 Commit changes → 다시 Commit changes<br>' +
        '· 1~2분 뒤 배포 상태가 초록 ✔이면 앱을 다시 여세요<br>' +
        '· 앱이 안 열리면 쉼표·따옴표 실수! 데이터 보기에서 확인</span></div>' +
      '<button class="btn close" data-close>닫기</button>';
    showSheet();
  }

  var titleTaps = [];
  document.getElementById('app-title').addEventListener('click', function () {
    var now = Date.now();
    titleTaps = titleTaps.filter(function (t) { return now - t < 2000; });
    titleTaps.push(now);
    if (titleTaps.length >= 5) { titleTaps = []; if (trip) openAdmin(); }
  });

  // ---------- 15. 터치·클릭 처리 ----------
  document.querySelectorAll('.tabbar button').forEach(function (b) {
    b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon));
  });
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

  backdrop.addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeSheet();
    if (e.target.closest('[data-reload]')) location.reload();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  // ---------- 16. 오프라인 지원 등록 (NFR-03) ----------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () { /* 무시 */ });
    });
  }

  init();
})();
