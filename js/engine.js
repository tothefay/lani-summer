/* ลานี่ ซัมเมอร์ — เอนจินเกม
   อ่านคู่มือรูปแบบฉาก (scene) ใน README.md ก่อนแก้ไฟล์นี้
   ส่วนหลัก: สถานะ/เซฟ → เอฟเฟกต์(fx) → เรนเดอร์ฉาก → แผนที่(hub) → เมนูต่าง ๆ → หน้าชื่อเรื่อง/สร้างตัวละคร */
(function(){
'use strict';
const CFG = window.CONFIG, D = window.DATA;
const $ = (s, r=document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; };
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const rnd = a => a[Math.floor(Math.random()*a.length)];
const G = window.GAME = { chapters:{}, scenes:{}, events:[], S:null, snap:null, say:(n,t)=>`**${n}:** "${t}"` };
let S = null; // สถานะปัจจุบัน (อัปเดตเมื่อโหลด)
const KEY = 'lani_summer_';

/* ===================== ที่เก็บข้อมูล ===================== */
function loadJSON(k, def){ try{ const v = localStorage.getItem(KEY+k); return v ? JSON.parse(v) : def; }catch(e){ return def; } }
function saveJSON(k, v){ try{ localStorage.setItem(KEY+k, JSON.stringify(v)); return true; }catch(e){ return false; } }
let META = {ach:{}, endings:{}, plays:0, totalMs:0};
let SET = {font:1, theme:'auto', petals:true, speed:'normal'};

function applySettings(){
  document.documentElement.style.setProperty('--fs', ({0:'0.95rem',1:'1.05rem',2:'1.2rem'})[SET.font]);
  document.documentElement.setAttribute('data-theme', SET.theme);
  const p = $('#petals'); p.innerHTML = '';
  if(SET.petals) for(let i=0;i<9;i++){
    const d = el('div','petal', rnd(['🌺','🌸','🌺']));
    d.style.left = (Math.random()*100)+'vw'; d.style.animationDuration = (9+Math.random()*9)+'s'; d.style.animationDelay = (-Math.random()*12)+'s';
    p.appendChild(d);
  }
}

/* ===================== สถานะ ===================== */
function newState(){
  const stat = {}; for(const k in CFG.stats) stat[k] = CFG.stats[k].start;
  return { v:1, name:'', nick:'', persona:'', look:{}, interest:'',
    day:CFG.startDay, slot:0, weather:'sunny', money:CFG.startMoney, stat,
    rel:{}, hearts:{}, met:{}, flags:{}, items:[], unlocked:[],
    collect:{shell:[],flower:[],food:[],place:[],photo:[]},
    diary:[], dayLog:[], log:[], chats:{}, chatAsk:{}, unread:{}, txn:[],
    chosen:{}, seen:{}, choices:0, cur:null, loc:null, mode:'story', freeDays:0, playMs:0, ng:0 };
}
function setS(s){ S = s; G.S = s; }
G.getS = () => S;

function levelOf(id){
  const n = D.npcs[id]; if(!n || !n.rel) return null;
  const r = S.rel[id] || 0, h = S.hearts[id] || 0;
  let idx = 0;
  CFG.relLevels.forEach((l,i)=>{ if(r >= l.min) idx = i; });
  if(!n.romance) idx = Math.min(idx, 3);                       // เพื่อนซี้หยุดที่ "สนิท"
  else { if(idx >= 4 && h < 3) idx = 3; if(idx >= 5 && !S.flags['couple_'+id]) idx = 4; }
  return {idx, name: CFG.relLevels[idx].name};
}
const weekday = () => CFG.dayNames[S.day % 7];
const isWeekend = () => (S.day % 7 === 0 || S.day % 7 === 6);
const season = () => { let s = CFG.seasons[0]; CFG.seasons.forEach(x => { if(S.day >= x.fromDay) s = x; }); return s.name; };

/* ===================== โทสต์/เอฟเฟกต์ ===================== */
function toast(msg, cls){
  const c = $('#toasts'), t = el('div','toast '+(cls||''), msg); c.appendChild(t);
  setTimeout(()=>t.classList.add('out'), 2200); setTimeout(()=>t.remove(), 2800);
}
function colName(type, id){ const f = (D.col[type]||[]).find(x=>x.id===id); return f ? f.emoji+' '+f.name : id; }

function applyFx(fx){
  if(!fx) return;
  if(fx.stat) for(const k in fx.stat){ const d = fx.stat[k]; if(!(k in S.stat)) continue; S.stat[k] = clamp(S.stat[k]+d, 0, 100);
    if(d) toast(`${CFG.stats[k].emoji} ${CFG.stats[k].name} ${d>0?'+':''}${d}`, d>0?'up':'down'); }
  if(fx.money){ S.money += fx.money; S.txn.unshift({d:S.day, t:fx.why||'รายการ', v:fx.money}); S.txn.length = Math.min(S.txn.length, 30);
    toast(`💵 ${fx.money>0?'+':''}${fx.money}$`, fx.money>0?'up':'down'); }
  if(fx.rel) for(const k in fx.rel){ S.rel[k] = Math.max(0,(S.rel[k]||0)+fx.rel[k]); if(fx.rel[k]) toast(`🤝 ${D.npcName(k)} สนิทขึ้น ${fx.rel[k]>0?'+':''}${fx.rel[k]}`, fx.rel[k]>0?'up':'down'); }
  if(fx.heart) for(const k in fx.heart){ S.hearts[k] = Math.max(0,(S.hearts[k]||0)+fx.heart[k]); if(fx.heart[k]>0) toast(`💗 ${D.npcName(k)} ใจเต้น +${fx.heart[k]}`, 'up'); }
  if(fx.meet) [].concat(fx.meet).forEach(id => { if(!S.met[id]){ S.met[id]=1; toast(`🤝 ได้รู้จัก ${D.npcName(id)}`); } });
  if(fx.flag) [].concat(fx.flag).forEach(f => S.flags[f] = true);
  if(fx.set) Object.assign(S.flags, fx.set);
  if(fx.unflag) [].concat(fx.unflag).forEach(f => delete S.flags[f]);
  if(fx.item) [].concat(fx.item).forEach(i => { if(!S.items.includes(i)){ S.items.push(i); toast(`🎒 ได้รับ: ${D.items[i]?D.items[i].name:i}`); } });
  if(fx.useItem) [].concat(fx.useItem).forEach(i => { S.items = S.items.filter(x=>x!==i); });
  if(fx.unlock) [].concat(fx.unlock).forEach(l => { if(!S.unlocked.includes(l)){ S.unlocked.push(l); toast(`🗺️ ปลดล็อก: ${D.loc[l]?D.loc[l].name:l}`); } });
  if(fx.collect) for(const t in fx.collect) [].concat(fx.collect[t]).forEach(id => { if(!S.collect[t].includes(id)){ S.collect[t].push(id); toast(`📒 สมุดสะสม: ${colName(t,id)}`); } });
  if(fx.diary) S.dayLog.push(fx.diary);
  if(fx.chat) pushChat(fx.chat);
  if(fx.ach) unlockAch(fx.ach);
  if(fx.fn) fx.fn(S, G);
  checkAch();
}
function unlockAch(id){
  if(META.ach[id]) return; const a = D.achievements.find(x=>x.id===id); if(!a) return;
  META.ach[id] = Date.now(); saveJSON('meta', META); toast(`🏆 ความสำเร็จ: ${a.name}`, 'up');
}
function checkAch(){ D.achievements.forEach(a => { if(a.check && !META.ach[a.id]){ try{ if(a.check(S)) unlockAch(a.id); }catch(e){} } }); }
function pushChat(c){
  const arr = (S.chats[c.who] = S.chats[c.who] || []);
  (c.msgs||[]).forEach(t => arr.push({me:0, t}));
  if(c.ask) S.chatAsk[c.who] = c.ask;
  S.unread[c.who] = true;
  toast(`📱 ข้อความใหม่ — ${(D.contacts[c.who]||{name:c.who}).name}`);
}

/* ===================== แปลงข้อความ ===================== */
function fmt(s){
  s = esc(s).replace(/\{nick\}/g, esc(S.nick||S.name||'เธอ')).replace(/\{name\}/g, esc(S.name||S.nick||'เธอ'));
  s = s.replace(/\{\{(\w+)\|([^}]+)\}\}/g, (m,id,label)=>`<span class="hot" data-id="${id}">${label}</span>`);
  s = s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/\n/g,'<br>');
  return s;
}
function plain(s){ return String(s).replace(/\{nick\}/g, S.nick||'เธอ').replace(/\{\{\w+\|([^}]+)\}\}/g,'$1').replace(/\*/g,'').replace(/^(# |> )/,''); }
function lines(t){
  if(t == null) return [];
  if(typeof t === 'function') return lines(t(S));
  if(Array.isArray(t)) return t.flatMap(lines);
  if(typeof t === 'object') return (t.if === undefined || t.if(S)) ? lines(t.t) : [];
  return [String(t)];
}
function logLine(s){ S.log.push(plain(s)); if(S.log.length > 250) S.log.shift(); }
function addPara(box, s, delay){
  if(s === '---'){ box.appendChild(el('div','divider','🌺 ✿ 🌴')); return null; }
  let cls = 'para';
  if(s.startsWith('# ')){ cls += ' sys'; s = s.slice(2); } else if(s.startsWith('> ')){ cls += ' quote'; s = s.slice(2); }
  const p = el('p', cls, fmt(s)); p.style.animationDelay = (delay||0)+'s'; box.appendChild(p); logLine(s); return p;
}
const speedStep = () => ({normal:0.28, fast:0.06, off:0})[SET.speed] ?? 0.28;

/* ===================== ลงทะเบียนบท/อีเวนต์ ===================== */
G.registerChapter = function(ch){
  G.chapters[ch.id] = ch;
  for(const k in ch.scenes){ const sc = ch.scenes[k]; sc._id = ch.id+'.'+k; sc._ch = ch.id; G.scenes[sc._id] = sc; }
};
G.registerEvents = function(list){
  list.forEach(e => { e.scene._id = 'ev.'+e.id; e.scene._ch = 'ev'; G.scenes[e.scene._id] = e.scene; G.events.push(e); });
};

/* ===================== เรนเดอร์ฉาก ===================== */
function snapshot(){ G.snap = JSON.stringify(S); }
function updateStatus(){
  const b = $('#statusbar');
  if(!S || !S.cur){ b.classList.add('hidden'); return; }
  b.classList.remove('hidden');
  b.innerHTML = `<span>📅 <b>${weekday()}</b> · ${CFG.slotNames[S.slot]}</span><span>💵 <b>${S.money}$</b></span><span>⚡ <b>${S.stat.energy}</b></span><span>😊 <b>${S.stat.happy}</b></span><span>${CFG.weathers[S.weather].emoji} ${CFG.weathers[S.weather].name}</span>`;
}
function resetStage(bg){
  const st = $('#stage'); st.innerHTML = ''; st.className = 'card bg-'+(bg||'plain');
  $('#bar').classList.remove('hidden'); window.scrollTo({top:0});
  return st;
}
function whereBar(text, time){
  return el('div','where', `<span>${text}</span><span>${time}</span>`);
}

function go(t){
  if(!t) return showHub();
  if(t[0] === '@'){
    if(t === '@hub'){ if(S.mode !== 'hub'){ S.mode = 'hub'; S.freeDays = 0; } return showHub(); }
    if(t === '@advance') return advance();
    if(t === '@night') return night();
    if(t === '@tbc') return showTbc();
    if(t === '@title') return showTitle();
    if(t.startsWith('@ending:')) return showEnding(t.slice(8));
  }
  const cur = S.cur && S.cur.includes('.') ? S.cur.split('.')[0] : 'ch01';
  renderScene(t.includes('.') ? t : cur+'.'+t);
}
G.go = go;

function renderScene(id){
  const sc = G.scenes[id];
  if(!sc){ $('#stage').innerHTML = `<p>⚠️ ไม่พบฉาก <b>${esc(id)}</b> (ตรวจชื่อฉากในไฟล์บท)</p><button class="btn" onclick="GAME.go('@title')">กลับหน้าแรก</button>`; return; }
  S.cur = id; if(sc._ch !== 'ev') S.loc = null;
  snapshot(); autosave();                       // เซฟไว้ก่อนใส่ผลของฉาก (โหลดแล้วจะเริ่มฉากนี้ใหม่)
  S.seen[id] = 1;
  if(sc.enter) sc.enter(S, G);
  applyFx(sc.fx);
  const st = resetStage(sc.bg || (S.weather==='drizzle'||S.weather==='storm' ? 'rain' : 'plain'));
  updateStatus();
  const locName = S.loc && D.loc[S.loc] ? D.loc[S.loc].emoji+' '+D.loc[S.loc].name : '';
  st.appendChild(whereBar(sc.where || locName || '🌺 ลานี่ ซัมเมอร์', sc.time || `${weekday()} · ${CFG.slotNames[S.slot]} ${CFG.weathers[S.weather].emoji}`));

  const story = el('div','story'); st.appendChild(story);
  let d = 0; const step = speedStep();
  lines(sc.text).forEach(s => { addPara(story, s, d); d += step; });
  const flav = sc.flav && sc.flav[S.persona];
  if(flav) lines(flav).forEach(s => { addPara(story, s, d); d += step; });

  const endbox = el('div'); st.appendChild(endbox);
  let shown = false;
  const showEnd = () => { if(shown) return; shown = true; renderEnd(sc, endbox); };

  const hots = story.querySelectorAll('.hot');
  if(!hots.length){ setTimeout(showEnd, d*1000 + 150); }
  else {
    let left = hots.length, clicked = 0;
    const skip = el('button','skip','พอแล้ว ไปต่อเลย ›'); skip.style.display = 'none';
    skip.onclick = () => { skip.remove(); showEnd(); }; st.insertBefore(skip, endbox);
    hots.forEach(h => h.addEventListener('click', () => {
      if(h.classList.contains('done')) return;
      h.classList.add('done'); left--; clicked++;
      const def = sc.hot && sc.hot[h.dataset.id];
      if(def){
        if(def.fx) applyFx(def.fx);
        const rev = el('div','reveal'); let k = 0;
        lines(def.t).forEach(s => addPara(rev, s, k++*0.15));
        const para = h.closest('.para'); para.parentNode.insertBefore(rev, para.nextSibling);
        rev.scrollIntoView({block:'nearest', behavior:'smooth'});
      }
      updateStatus();
      if(clicked >= 1) skip.style.display = 'block';
      if(left === 0){ skip.remove(); showEnd(); }
    }));
  }
}

function renderEnd(sc, box){
  box.innerHTML = '';
  if(sc.mini) return renderMini(sc, box);
  if(sc.choices && sc.choices.length) return renderChoices(sc, box);
  if(sc.chEnd) return renderChapterEnd(sc, box);
  const b = el('div','endbox'); const btn = el('button','btn', sc.btn || 'ไปต่อ ›'); btn.onclick = () => go(sc.next); b.appendChild(btn); box.appendChild(b);
}

function renderChoices(sc, box){
  const wrap = el('div','choices'); box.appendChild(wrap);
  const items = [];
  sc.choices.forEach((c, i) => {
    const okc = c.if === undefined || c.if(S);
    if(!okc && c.hide) return;
    const b = el('button','choice'+(okc?'':' locked'));
    b.innerHTML = `<span class="bar">|</span>${fmt(lines(c.t).join(' '))}` + (okc ? '' : `<span class="lock">🔒 ${esc(c.lock||'ยังไม่ปลดล็อก')}</span>`);
    if(!okc) b.disabled = true;
    else b.onclick = () => {
      S.choices++; S.chosen[sc._id] = i; logLine('▶ '+lines(c.t).join(' '));
      items.forEach(x => { x.disabled = true; x.classList.add(x===b?'picked':'dim'); });
      applyFx(c.fx); updateStatus();
      const res = el('div','choice-res'); wrap.appendChild(res);
      let d = 0; lines(c.res).forEach(s => { addPara(res, s, d); d += speedStep(); });
      const fl = c.flav && c.flav[S.persona]; if(fl) lines(fl).forEach(s => { addPara(res, s, d); d += speedStep(); });
      const target = c.go !== undefined ? c.go : sc.next;
      const nb = el('div','endbox'); const btn = el('button','btn','ไปต่อ ›'); btn.onclick = () => go(target); nb.appendChild(btn);
      if(d === 0 && !c.keep) go(target); else { wrap.appendChild(nb); nb.scrollIntoView({block:'nearest',behavior:'smooth'}); }
    };
    items.push(b); wrap.appendChild(b);
  });
  if(!items.length){ const btn = el('button','btn','ไปต่อ ›'); btn.onclick = () => go(sc.next); box.appendChild(btn); }
  wrap.scrollIntoView({block:'nearest', behavior:'smooth'});
}

function renderChapterEnd(sc, box){
  const ch = G.chapters[sc._ch]; const n = CFG.chapterOrder.indexOf(sc._ch)+1;
  S.flags['done_'+sc._ch] = true;
  const c = el('div','center');
  c.innerHTML = `<div class="aloha-border"></div><h2 class="hand">✿ จบบทที่ ${n}: ${esc(ch.title)} ✿</h2>`;
  if(sc.chEnd.summary) c.appendChild(el('p','', fmt(sc.chEnd.summary)));
  if(sc.chEnd.hook) c.appendChild(el('p','', '<i>'+fmt(sc.chEnd.hook)+'</i>'));
  c.appendChild(el('p','muted','💾 บันทึกอัตโนมัติแล้ว'));
  const btn = el('button','btn', sc.chEnd.btn || 'บทถัดไป ›'); btn.onclick = () => go(sc.next); c.appendChild(btn);
  box.appendChild(c); autosave();
}

/* ===================== มินิเกมจับคู่ดอกชบา ===================== */
function renderMini(sc, box){
  const m = sc.mini; const wrap = el('div','center'); box.appendChild(wrap);
  wrap.appendChild(el('p','', fmt(m.intro || '# มินิเกม: จับคู่ดอกชบา — เปิดการ์ดทีละ 2 ใบ ถ้าเหมือนกันจะอยู่ค้างไว้ (แพ้ก็ไม่ตาย)')));
  const start = el('button','btn alt','เริ่มเล่น 🌺'); wrap.appendChild(start);
  const skip = el('button','skip','ข้ามมินิเกม (นับเป็นผลกลาง ๆ)'); wrap.appendChild(skip);
  const finish = (grade) => {
    wrap.innerHTML = ''; const r = (m.results||{})[grade] || {};
    const res = el('div'); let d = 0; lines(r.res).forEach(s => { addPara(res, s, d); d += speedStep(); }); wrap.appendChild(res);
    if(r.fx) applyFx(r.fx); if(grade === 'great') S.flags.match_great = true; checkAch(); updateStatus();
    const btn = el('button','btn','ไปต่อ ›'); btn.onclick = () => go(r.go || m.next || sc.next); wrap.appendChild(btn);
  };
  skip.onclick = () => finish('ok');
  start.onclick = () => {
    wrap.innerHTML = '<p class="muted">จำตำแหน่งดอกไม้ให้ได้ — จำนวนครั้งที่เปิด: <b id="mv">0</b></p>';
    const icons = ['🌺','🐚','🐠','🌴','🍍','🦀']; const deck = icons.concat(icons).sort(()=>Math.random()-.5);
    const grid = el('div','matchgrid'); wrap.appendChild(grid);
    let open = [], moves = 0, ok = 0, lockIt = false;
    deck.forEach(ic => {
      const c = el('button','mcard','🌴'); c.dataset.v = ic; grid.appendChild(c);
      c.onclick = () => {
        if(lockIt || c.classList.contains('open') || c.classList.contains('ok')) return;
        c.classList.add('open'); c.textContent = ic; open.push(c);
        if(open.length === 2){
          moves++; $('#mv').textContent = moves; lockIt = true;
          const [a,b] = open;
          if(a.dataset.v === b.dataset.v){ a.className = b.className = 'mcard ok'; ok++; open = []; lockIt = false;
            if(ok === 6) setTimeout(()=>finish(moves<=9?'great':moves<=14?'ok':'meh'), 600); }
          else setTimeout(()=>{ a.className = b.className = 'mcard'; a.textContent = b.textContent = '🌴'; open = []; lockIt = false; }, 700);
        }
      };
    });
  };
}

/* ===================== แผนที่ / ตารางประจำวัน ===================== */
function locOpen(l){ return l.open || S.unlocked.includes(l.id); }
function locBlock(l){
  if(S.stat.energy < 10) return 'เหนื่อยเกินไป ต้องพัก';
  if(l.outdoor && S.weather === 'storm') return 'พายุ — ออกไปไม่ได้';
  if(!isWeekend() && S.slot < 2 && l.area !== 'school') return 'ติดเรียน ไปหลังเลิกเรียนนะ';
  if(l.area === 'home' && !isWeekend() && S.slot < 2) return 'ติดเรียน';
  return null;
}
let hubTab = 'school';
function showHub(){
  S.cur = '@hub'; S.mode = 'hub'; S.loc = null; snapshot(); autosave(); checkAch();
  const st = resetStage(S.weather==='drizzle'||S.weather==='storm' ? 'rain' : (S.slot===3?'night':'plain')); updateStatus();
  st.appendChild(whereBar('🗺️ แผนที่ — ไปไหนดี?', `${weekday()} · ${CFG.slotNames[S.slot]} ${CFG.weathers[S.weather].emoji}`));
  const w = CFG.weathers[S.weather];
  st.appendChild(el('p','', `วัน<b>${weekday()}</b> ช่วง<b>${CFG.slotNames[S.slot]}</b> · <span class="weather-chip">${w.emoji} ${w.name}</span> · ${season()}<br><span class="muted">ทุกช่วงเลือกไปได้ 1 ที่ · วันธรรมดาช่วงเช้า/พักเที่ยงต้องอยู่ในโรงเรียน</span>`));
  const areas = ['school','around','town','food','home'].filter(a => Object.values(D.loc).some(l => l.area===a && locOpen(l)));
  if(!areas.includes(hubTab)) hubTab = areas[0];
  const tabs = el('div','tabs'); areas.forEach(a => { const t = el('button','tab'+(a===hubTab?' sel':''), D.areaNames[a]); t.onclick = () => { hubTab = a; showHub(); }; tabs.appendChild(t); }); st.appendChild(tabs);
  const grid = el('div','mapgrid');
  Object.values(D.loc).filter(l => l.area===hubTab && locOpen(l)).forEach(l => {
    const why = locBlock(l); const b = el('button','loc', `${l.emoji} ${esc(l.name)}${why?`<small>🔒 ${why}</small>`:''}`);
    if(why) b.disabled = true; else b.onclick = () => visit(l.id);
    grid.appendChild(b);
  });
  st.appendChild(grid);
  const act = el('div','center');
  const rest = el('button','btn alt small','😴 พักที่บ้านช่วงนี้ (+25 พลังงาน)');
  rest.onclick = () => { applyFx({stat:{energy:+25, happy:+2}, diary:'พักผ่อนที่บ้าน นอนกลิ้งบนโซฟาตัวใหญ่ (ผมยังพังอยู่)'}); advance(); };
  act.appendChild(rest);
  const ph = el('button','btn ghost small','📱 เปิดมือถือ'); ph.onclick = () => openPhone(); act.appendChild(ph);
  st.appendChild(act);
}

function visit(locId){
  const l = D.loc[locId]; S.loc = locId; S.stat.energy = clamp(S.stat.energy - CFG.visitCost, 0, 100);
  applyFx({collect:{place:locId}});
  const ev = pickEvent(locId);
  S.slotLoc = locId; renderScene(ev);
}
function pickEvent(locId){
  const l = D.loc[locId]; const wd = S.day % 7;
  const ok = e => {
    if(e.once && S.seen['ev.'+e.id]) return false;
    if(e.loc && ![].concat(e.loc).includes(locId)) return false;
    if(e.area && e.area !== l.area) return false;
    if(e.slots && !e.slots.includes(S.slot)) return false;
    if(e.days && !e.days.includes(wd)) return false;
    if(e.weather && !e.weather.includes(S.weather)) return false;
    if(e.if && !e.if(S)) return false;
    return true;
  };
  const cands = G.events.filter(ok);
  const prio = cands.filter(e => e.prio);
  const pool = prio.length ? prio : cands;
  if(pool.length){
    const tot = pool.reduce((a,e)=>a+(e.weight||1),0); let r = Math.random()*tot;
    for(const e of pool){ r -= (e.weight||1); if(r <= 0) return 'ev.'+e.id; }
    return 'ev.'+pool[0].id;
  }
  return makeGeneric(l);
}
const GENERIC = {
  school:['{p} เงียบกว่าที่คิด ลมทะเลพัดผ่านหน้าต่างเป็นระยะ เธอยืนมองเฉย ๆ แล้วรู้สึกว่าโรงเรียนนี้เริ่มคุ้นขึ้นนิดหนึ่ง','เธอแวะ {p} แล้วเจอนักเรียนกำลังกระซิบกระซาบ พอเห็นเธอก็หยุด แล้วทำเป็นคุยเรื่องสภาพอากาศอย่างพร้อมเพรียง','เธอนั่งพักใน {p} แล้วหลับไป 5 นาที ตื่นมา ไม่มีใครเห็น (หวังว่านะ)','{p} มีกลิ่นเฉพาะตัวแบบที่เธอจำได้ไปอีกนาน — เกลือ ไม้เก่า และความสงบเล็ก ๆ'],
  around:['ลมที่ {p} พัดผมเธอพังซ้ำในจุดที่เพิ่งจัดเสร็จ เป็นความสม่ำเสมอที่น่านับถือ','เธอยืนมองทะเลจาก {p} นาน ๆ แล้วคิดว่า ถ้าแม่เห็นคงอยากเอาปลาวาฬมาแนะนำ','มีนกนางนวลบินวนเหนือหัวที่ {p} เธอปกป้องขนมในกระเป๋าด้วยชีวิต','คลื่นซัดเป็นจังหวะที่ {p} เธอนับตามจนลืมไปว่าเธอกลัวมัน'],
  town:['{p} คึกคักกว่าที่คิด ผู้คนยิ้มทักทายกันแบบไม่ต้องรู้จัก เธอยิ้มตอบจนแก้มเมื่อย','เธอเดินดูของที่ {p} จนเจอป้ายราคาที่ทำให้กระเป๋าตังค์ถอนหายใจ','มีคุณลุงคนหนึ่งชูนิ้วโป้งกับก้อยให้ที่ {p} (ชากะ!) เธอชูกลับไปแบบมั่นใจเกินจริง','กลิ่นอาหารลอยมาจาก {p} กระเพาะเธอประกาศอิสรภาพ'],
  food:['เธอแวะ {p} แค่ดูเมนู (ในใจคือกินหมดแล้วทุกอย่าง)','พนักงานที่ {p} ยิ้มและพูดว่า "อะโลฮ่า!" แบบที่ทำให้เธอรู้สึกเหมือนมาถึงบ้าน','กลิ่นหอมที่ {p} ทำให้เธอยืนนิ่งกลางทางจนคนข้างหลังต้องเลี่ยง','เธอเก็บบรรยากาศ {p} ไว้ในใจ แล้วสัญญาว่าจะกลับมาตอนมีเงินมากกว่านี้'],
  home:['เธอใช้เวลาที่ {p} เงียบ ๆ เสียงฝนหรือเสียงคลื่นดังเป็นฉากหลัง บ้านหลังนี้เริ่มเป็นบ้านจริง ๆ นิดหนึ่ง','ที่ {p} เธอเปิดโทรศัพท์ดูข้อความแม่ (ยังเป็นข้อความอัตโนมัติ) แล้ววางลงด้วยรอยยิ้มแหยง ๆ','เธอจัดของที่ {p} เสร็จไปหนึ่งมุม — ซึ่งน่าภูมิใจมากสำหรับเธอ']
};
function makeGeneric(l){
  const pool = GENERIC[l.area] || GENERIC.school;
  const txt = rnd(pool).replace(/\{p\}/g, l.name);
  const id = 'ev.__generic';
  const fxPool = [{stat:{happy:+2}}, {stat:{luck:+1}}, {stat:{curious:+1}}, {stat:{friend:+1}}, {stat:{energy:+2}}];
  G.scenes[id] = {_id:id, _ch:'ev', text:[txt], fx:Object.assign({diary:`ไปที่ ${l.name} — ไม่มีเรื่องใหญ่ แต่ก็ดี`}, rnd(fxPool)), next:'@advance'};
  return id;
}
function advance(){
  S.slot++; S.loc = null;
  if(S.slot >= 4) return night();
  showHub();
}
function night(){
  S.flags.full_day = true; checkAch();
  const entries = S.dayLog.length ? S.dayLog : ['วันนี้ไม่มีอะไรเกิดขึ้น (หรือมีแต่ฉันลืมจด)'];
  const closers = ['ปล. ผมยังพังอยู่ แต่ฉันเริ่มชินแล้ว','ปล. ถ้าพรุ่งนี้ปูมาอีก ฉันจะแจ้งความ','ปล. ทะเลที่นี่เสียงดังตลอดคืน แต่เป็นเสียงที่ทำให้หลับได้จริง ๆ','ปล. คิดถึงบ้านนิดหน่อย แต่คิดถึงกะเพราเยอะกว่า'];
  const text = `📔 ไดอารี่ลับของ ${S.nick||S.name} — คืนวัน${weekday()}\n`+entries.map(e=>'• '+e).join('\n')+'\n'+rnd(closers);
  S.diary.push({day:S.day, text}); logLine('(ไดอารี่) '+text);
  S.cur = '@hub'; snapshot();
  const st = resetStage('night'); updateStatus();
  st.appendChild(whereBar('🌙 ห้องนอนใต้หลังคา', `ค่ำ · ${weekday()}`));
  const story = el('div','story'); st.appendChild(story);
  story.appendChild(el('p','para quote', esc(text).replace(/\n/g,'<br>')));
  const btn = el('button','btn','🛏️ นอนหลับ (ฟื้นพลังงาน)'); const c = el('div','endbox'); c.appendChild(btn); st.appendChild(c);
  btn.onclick = () => {
    applyFx({stat:{energy:+40, happy:+1}});
    S.day++; S.slot = 0; S.dayLog = []; S.freeDays++;
    const tot = Object.values(CFG.weathers).reduce((a,w)=>a+w.w,0); let r = Math.random()*tot;
    for(const k in CFG.weathers){ r -= CFG.weathers[k].w; if(r<=0){ S.weather = k; break; } }
    if(S.weather === 'storm') S.flags.storm_seen = true;
    if(S.freeDays >= CFG.freeDays) return showTbc();
    showHub();
  };
}
function showTbc(){
  S.cur = '@hub'; snapshot(); autosave();
  const st = resetStage('sunset'); updateStatus();
  const c = el('div','center');
  c.innerHTML = `<div class="aloha-border"></div><h2 class="hand">🌅 จบเนื้อหารอบแรก</h2>
  <p>ตอนนี้เป็นเช้าวันเสาร์ — วันนัดเก็บขยะกับคาเลโอตอนตีห้าครึ่ง (และความลับเรื่องว่ายน้ำของเธอกำลังจะถูกทดสอบ)</p>
  <p><i>บทที่ 5 เป็นต้นไปจะมาในรอบถัดไป ตอนนี้ยังเล่นแผนที่อิสระต่อได้เพื่อสะสมความสนิท ของสะสม และความสำเร็จ</i></p>
  <p class="muted">เล่นมา ${Math.floor(S.playMs/60000)} นาที · เลือกไป ${S.choices} ครั้ง</p>`;
  const a = el('button','btn alt','🗺️ เล่นแผนที่อิสระต่อ'); a.onclick = () => { S.freeDays = 0; showHub(); };
  const b = el('button','btn','💾 บันทึก'); b.onclick = () => openSaves('save');
  const d = el('button','btn ghost','🏠 หน้าแรก'); d.onclick = showTitle;
  c.append(a,b,d); st.appendChild(c);
}
function showEnding(id){
  const e = D.endings.find(x=>x.id===id) || {name:id};
  META.endings[id] = Date.now(); saveJSON('meta', META); unlockAch('endings_1');
  const st = resetStage('sunset'); const c = el('div','center');
  c.innerHTML = `<div class="aloha-border"></div><h2 class="hand">🏁 ${esc(e.name)}</h2><p class="muted">ปลดล็อกในหน้าสะสมฉากจบแล้ว</p>`;
  const b = el('button','btn','🏠 หน้าแรก'); b.onclick = showTitle; c.appendChild(b); st.appendChild(c);
}
G.showEnding = showEnding;

/* ===================== เซฟ/โหลด ===================== */
function metaOf(){ const ch = S.cur && S.cur.includes('.') ? (G.chapters[S.cur.split('.')[0]]||{}).title : (S.mode==='hub'?'แผนที่อิสระ':''); return {name:S.nick||S.name, where:ch||'', day:`${weekday()} · ${CFG.slotNames[S.slot]}`, ts:Date.now()}; }
function writeSlot(slot){ if(!G.snap) return false; return saveJSON('slot_'+slot, {meta:metaOf(), state:G.snap}); }
function autosave(){ if(G.snap) writeSlot('auto'); }
function readSlot(slot){ return loadJSON('slot_'+slot, null); }
function loadSlot(slot){
  const d = readSlot(slot); if(!d) return;
  setS(JSON.parse(d.state)); closeModal(); resume();
}
function resume(){
  if(!S.chats) S.chats = {};
  if(S.cur === '@hub' || !S.cur) showHub(); else renderScene(S.cur);
}
function openSaves(mode){
  const c = el('div');
  const slots = ['auto'].concat(Array.from({length:CFG.saveSlots}, (_,i)=>i+1));
  const draw = () => {
    c.innerHTML = '';
    slots.forEach(sl => {
      const d = readSlot(sl); const box = el('div','slot');
      const label = sl==='auto' ? '⚙️ บันทึกอัตโนมัติ' : `💾 ช่อง ${sl}`;
      box.innerHTML = `<b>${label}</b><br><span class="muted">${d ? `${esc(d.meta.name)} · ${esc(d.meta.where)} · ${esc(d.meta.day)}<br>${new Date(d.meta.ts).toLocaleString('th-TH')}` : '— ว่าง —'}</span><br>`;
      if(mode==='save' && sl!=='auto'){ const b = el('button','btn small','บันทึกที่นี่'); b.onclick = () => { if(!G.snap){ toast('ยังไม่มีเกมให้บันทึก'); return; } writeSlot(sl) ? toast('💾 บันทึกแล้ว','up') : toast('บันทึกไม่ได้ (เบราว์เซอร์บล็อกที่เก็บข้อมูล?)','down'); draw(); }; box.appendChild(b); }
      if(d){ const l = el('button','btn alt small','โหลด'); l.onclick = () => loadSlot(sl); box.appendChild(l);
        if(sl!=='auto'){ const x = el('button','btn ghost small','ลบ'); x.onclick = () => { if(confirm('ลบเซฟนี้?')){ try{ localStorage.removeItem(KEY+'slot_'+sl); }catch(e){} draw(); } }; box.appendChild(x); } }
      c.appendChild(box);
    });
    if(mode==='save') c.appendChild(el('p','muted','* การเซฟจะเก็บจุดเริ่มต้นของฉากปัจจุบัน (ข้อความสีชมพูที่กดไปแล้วในฉากนี้จะให้กดใหม่ได้)'));
  };
  draw(); openModal(mode==='save'?'💾 บันทึกเกม':'📂 โหลดเกม', c);
}

/* ===================== โมดัลและเมนู ===================== */
function openModal(title, node){
  const m = $('#modal'); m.innerHTML = ''; m.classList.remove('hidden');
  const sh = el('div','sheet'); const h = el('h2','', `<span>${title}</span>`); const x = el('button','x','✕'); x.onclick = closeModal; h.appendChild(x);
  sh.appendChild(h); sh.appendChild(node); m.appendChild(sh); m.onclick = ev => { if(ev.target === m) closeModal(); };
}
function closeModal(){ const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }
function tabsNode(defs){
  const wrap = el('div'); const tabs = el('div','tabs'); const body = el('div'); wrap.append(tabs, body);
  const show = i => { tabs.innerHTML = ''; defs.forEach((d,j) => { const t = el('button','tab'+(j===i?' sel':''), d[0]); t.onclick = () => show(j); tabs.appendChild(t); }); body.innerHTML = ''; body.appendChild(d_(defs[i][1])); };
  const d_ = f => { const r = f(); return typeof r === 'string' ? el('div','',r) : r; };
  show(0); return wrap;
}
function openLog(){
  const c = el('div'); if(!S.log.length) c.innerHTML = '<p class="muted">ยังไม่มีประวัติ</p>';
  S.log.slice(-80).forEach(t => c.appendChild(el('p','', esc(t)))); openModal('📓 ประวัติเรื่อง', c);
  const sh = $('#modal .sheet'); sh.scrollTop = sh.scrollHeight;
}
function openProfile(){
  openModal('👤 โปรไฟล์', tabsNode([
    ['ตัวเอก', () => { const L = S.look; return `<p><b>${esc(S.name)}</b> (${esc(S.nick)}) · ${esc((CFG.personas.find(p=>p.id===S.persona)||{}).name||'')}</p>
      <p class="muted">${esc(L.body||'')} · ผม${esc(L.hair||'')}สี${esc(L.hairColor||'')} · ผิว${esc(L.skin||'')} · ตา${esc(L.eyes||'')}<br>สไตล์: ${esc(L.style||'')} · สนใจ: ${esc((CFG.interests.find(i=>i.id===S.interest)||{}).name||'')}</p>
      <p>💵 ${S.money}$ · ${season()}</p>` + Object.keys(CFG.stats).map(k => `<div class="row"><span>${CFG.stats[k].emoji} ${CFG.stats[k].name}</span><div class="meter"><i style="width:${S.stat[k]}%"></i></div><b>${S.stat[k]}</b></div>`).join(''); }],
    ['ภารกิจ', () => { const q = D.quests.filter(x => S.flags[x.flag]); return q.length ? q.map(x => `<div class="row"><span>${S.flags[x.done]?'✅':'🔸'} <b>${x.name}</b><br><span class="muted">${x.desc}</span></span></div>`).join('') : '<p class="muted">ยังไม่มีภารกิจ</p>'; }],
    ['ของในกระเป๋า', () => S.items.length ? S.items.map(i => `<div class="row"><span>${D.items[i]?D.items[i].emoji+' '+D.items[i].name:i}</span></div>`).join('') : '<p class="muted">กระเป๋าว่าง</p>'],
    ['สถิติ', () => { const total = D.endings.length, got = Object.keys(META.endings).length;
      return `<div class="row"><span>⏱️ เวลาเล่น (เซฟนี้)</span><b>${Math.floor(S.playMs/60000)} นาที</b></div><div class="row"><span>🔘 จำนวนการเลือก</span><b>${S.choices}</b></div><div class="row"><span>🏁 ฉากจบที่เจอ</span><b>${got}/${total} (${Math.round(got/total*100)}%)</b></div><div class="row"><span>🏆 ความสำเร็จ</span><b>${Object.keys(META.ach).length}/${D.achievements.length}</b></div><div class="row"><span>📅 วันที่</span><b>${S.day}</b></div><p class="muted">เครดิต: เขียนและออกแบบโดย Claude (Anthropic) ตามพรอมท์ของผู้เล่น · ฟอนต์ Google Fonts</p>`; }]
  ]));
}
function openRel(){
  const c = el('div'); const ids = Object.keys(D.npcs).filter(k => D.npcs[k].rel);
  ids.forEach(id => { const n = D.npcs[id]; const met = S.met[id]; const lv = levelOf(id);
    c.appendChild(el('div','row', met ? `<span>${n.emoji} <b>${n.name}</b> <span class="muted">(${n.year})</span><br><span class="muted">${n.desc}</span></span><span style="text-align:right">${lv.name}<br>${'💗'.repeat(Math.min(S.hearts[id]||0,5))||'<span class="muted">—</span>'}</span>` : `<span>❔ <b>ยังไม่รู้จัก</b></span>`)); });
  openModal('💗 ความสัมพันธ์', c);
}
function openCollection(){
  const grid = (type) => () => { const have = S.collect[type]||[]; return (D.col[type]||[]).map(x => `<div class="row"><span>${have.includes(x.id)?x.emoji+' '+x.name:'❔ ???'}</span></div>`).join(''); };
  openModal('📒 สมุดสะสม', tabsNode([
    ['🐚 เปลือกหอย', grid('shell')], ['🌺 ดอกไม้', grid('flower')], ['🍽️ เมนู', grid('food')], ['📸 รูป', grid('photo')],
    ['🗺️ สถานที่', () => { const have = S.collect.place; return Object.values(D.loc).filter(l=>locOpen(l)||have.includes(l.id)).map(l => `<div class="row"><span>${have.includes(l.id)?l.emoji+' '+l.name:'❔ ยังไม่เคยไป'}</span></div>`).join(''); }],
    ['📔 ไดอารี่', () => S.diary.length ? S.diary.slice().reverse().map(d => `<div class="slot">${esc(d.text).replace(/\n/g,'<br>')}</div>`).join('') : '<p class="muted">ยังไม่มีไดอารี่ — จะเขียนให้ทุกคืนที่ได้นอน</p>'],
    ['🏁 ฉากจบ', () => D.endings.map(e => `<div class="row"><span>${META.endings[e.id]?'🏁 '+e.name:'❔ ???'}</span></div>`).join('')],
    ['🏆 ความสำเร็จ', () => D.achievements.map(a => `<div class="row"><span>${META.ach[a.id]?a.emoji+' <b>'+a.name+'</b><br><span class="muted">'+a.desc+'</span>':'🔒 <span class="muted">???</span>'}</span></div>`).join('')]
  ]));
}
function openSettings(){
  const c = el('div');
  const grp = (label, key, opts) => { const h = el('h3','', label); const d = el('div','chips');
    opts.forEach(([v,t]) => { const b = el('button','chip'+(SET[key]===v?' sel':''), t); b.onclick = () => { SET[key] = v; saveJSON('settings', SET); applySettings(); openSettings(); }; d.appendChild(b); }); c.append(h,d); };
  grp('ขนาดตัวอักษร','font',[[0,'เล็ก'],[1,'กลาง'],[2,'ใหญ่']]);
  grp('ธีมสี','theme',[['auto','อัตโนมัติ'],['light','สว่าง'],['dark','โหมดมืด']]);
  grp('กลีบชบาร่วง','petals',[[true,'เปิด'],[false,'ปิด']]);
  grp('ความเร็วข้อความ','speed',[['normal','ปกติ'],['fast','เร็ว'],['off','ทันที']]);
  openModal('⚙️ ตั้งค่า', c);
}
function openHelp(){
  openModal('❓ คู่มือการเล่น', el('div','', `
  <p><span class="hot">ข้อความสีชมพูแบบนี้</span> = กดได้ กดแล้วมีเนื้อหาเพิ่ม บางอันให้คะแนน ของ หรือมุกขำ ๆ กดอันไหนก่อนก็ได้</p>
  <div class="choices"><button class="choice" disabled><span class="bar">|</span>กล่องเขียวมิ้นต์ = ตัวเลือกสำคัญ มีผลจริงกับเนื้อเรื่อง ความสนิท และฉากที่ปลดล็อก</button></div>
  <p>🔒 ตัวเลือกสีเทา = ยังไม่ผ่านเงื่อนไข (ต้องมีไอเท็ม ต้องสนิทระดับหนึ่ง หรือเคยเลือกอะไรบางอย่าง)</p>
  <p>🗺️ เมื่อถึงช่วงแผนที่ แต่ละวันมี 4 ช่วง (เช้า/พักเที่ยง/หลังเลิกเรียน/ค่ำ) เลือกไปที่ไหนก็ได้ช่วงละ 1 ที่ ฝนตกหรือพายุมีผลต่อที่ที่ไปได้</p>
  <p>💗 ความสนิท: คนแปลกหน้า → รู้จัก → เพื่อน → สนิท → ใจเต้น → แฟน (ระดับสูงต้องมีหัวใจเต้นและฉากเฉพาะคน)</p>
  <p>💾 เกมเซฟอัตโนมัติทุกฉาก และเซฟเองได้ 3 ช่อง (เก็บในเบราว์เซอร์นี้)</p>`));
}
function openMenu(){
  const c = el('div','center'); const mk = (t, f, cls) => { const b = el('button','btn small '+(cls||''), t); b.onclick = () => { closeModal(); f(); }; c.appendChild(b); };
  mk('💾 บันทึก', ()=>openSaves('save')); mk('📂 โหลด', ()=>openSaves('load'),'alt'); mk('📒 สมุดสะสม', openCollection);
  mk('🗺️ แผนที่', () => { if(S.mode==='hub') showHub(); else toast('แผนที่จะเปิดใช้เต็มรูปแบบหลังจบบทที่ 4'); }, 'alt');
  mk('📱 มือถือ', openPhone); mk('⚙️ ตั้งค่า', openSettings,'alt'); mk('❓ ช่วยเหลือ', openHelp); mk('🏠 หน้าแรก', ()=>{ if(confirm('กลับหน้าแรก? (เซฟอัตโนมัติไว้แล้ว)')) showTitle(); },'ghost');
  openModal('☰ เมนู', c);
}

/* ===================== มือถือ ===================== */
let phoneApp = null, phoneChat = null;
function openPhone(){ phoneApp = null; phoneChat = null; drawPhone(); }
function drawPhone(){
  const ph = el('div','phone'); const scr = el('div','screen'); ph.appendChild(scr);
  const apps = el('div','apps'); [['chat','💬','แชท'],['gal','🖼️','รูป'],['soc','📣','โซเชียล'],['cal','📅','ปฏิทิน'],['bank','🏦','ธนาคาร']].forEach(([id,e,t]) => {
    const b = el('button','', `${e}<span>${t}</span>`); b.onclick = () => { phoneApp = id; phoneChat = null; drawPhone(); }; apps.appendChild(b); });
  scr.appendChild(apps);
  const body = el('div'); scr.appendChild(body);
  if(phoneApp === 'chat'){
    if(!phoneChat){
      const ids = Object.keys(S.chats); if(!ids.length) body.innerHTML = '<p class="muted">ยังไม่มีแชท</p>';
      ids.forEach(id => { const k = D.contacts[id]||{name:id,emoji:'💬'}; const row = el('div','contact', `<span>${k.emoji} ${k.name}</span>${(S.unread[id]||S.chatAsk[id])?'<span class="badge">ใหม่</span>':''}`); row.onclick = () => { phoneChat = id; S.unread[id] = false; drawPhone(); }; body.appendChild(row); });
    } else {
      const arr = S.chats[phoneChat] || []; const back = el('button','skip','‹ กลับ'); back.onclick = () => { phoneChat = null; drawPhone(); }; body.appendChild(back);
      arr.forEach(m => body.appendChild(el('div','bubble'+(m.me?' me':''), fmt(m.t))));
      const ask = S.chatAsk[phoneChat];
      if(ask){ const box = el('div','choices'); ask.forEach(o => { const b = el('button','choice', `<span class="bar">|</span>${fmt(o.t)}`);
        b.onclick = () => { arr.push({me:1, t:o.t}); (o.reply||[]).forEach(t => arr.push({me:0,t})); delete S.chatAsk[phoneChat]; applyFx(o.fx); updateStatus(); drawPhone(); };
        box.appendChild(b); }); body.appendChild(box); }
    }
  } else if(phoneApp === 'gal'){
    const p = S.collect.photo; body.innerHTML = p.length ? p.map(id => `<div class="row"><span>${colName('photo',id)}</span></div>`).join('') : '<p class="muted">ยังไม่มีรูป</p>';
  } else if(phoneApp === 'soc'){
    const posts = D.social.filter(x => !x.flag || S.flags[x.flag]); body.innerHTML = posts.map(x => `<div class="slot"><b>${x.who}</b><br>${esc(x.t)}</div>`).join('') || '<p class="muted">ยังไม่มีโพสต์</p>';
  } else if(phoneApp === 'cal'){
    body.innerHTML = `<p>วันนี้: <b>${weekday()}</b> (วันที่ ${S.day}) · ${season()}</p>` + D.calendar.filter(x => x.day >= S.day).map(x => `<div class="row"><span>วันที่ ${x.day} (${CFG.dayNames[x.day%7]}) — ${x.t}</span></div>`).join('');
  } else if(phoneApp === 'bank'){
    body.innerHTML = `<h3>ยอดเงิน: ${S.money}$</h3>` + (S.txn.map(t => `<div class="row"><span>วันที่ ${t.d} · ${esc(t.t)}</span><b style="color:${t.v>0?'#1a9':'#c35'}">${t.v>0?'+':''}${t.v}$</b></div>`).join('') || '<p class="muted">ยังไม่มีรายการ</p>');
  } else body.innerHTML = '<p class="muted center">เลือกแอปด้านบน</p>';
  openModal('📱 มือถือ', ph);
}

/* ===================== หน้าชื่อเรื่อง / สร้างตัวละคร ===================== */
function showTitle(){
  S = null; G.S = null; G.snap = null; closeModal();
  $('#bar').classList.add('hidden'); $('#statusbar').classList.add('hidden');
  $('#greeting').textContent = rnd(CFG.greetings);
  const st = $('#stage'); st.className = 'card bg-title'; st.innerHTML = '';
  const hasSave = ['auto',1,2,3].some(s => readSlot(s));
  const c = el('div','title-screen');
  c.innerHTML = `<div class="aloha-border"></div><div style="font-size:3rem">🌺🌊🌴</div><h1>${CFG.title}</h1><div class="sub">${CFG.subtitle}</div>
  <p class="tagline">ย้ายมาเกาะกลางภาคเรียน ผมพังจากลมทะเลตั้งแต่ก้าวแรก ปูมีนัดกับเธอทุกเช้า และความลับเล็ก ๆ ที่ว่ายน้ำไม่เก่งกำลังใหญ่ขึ้นทุกวัน<br>ฤดูร้อนนี้เธอจะรอดไหม? (ผมเธอน่ะไม่รอดแน่)</p>
  <div class="warn">⚠️ เกมนิยายสไตล์ slice-of-life โรแมนติกคอมเมดี้ ตัวละครทุกคนเป็นวัยรุ่น 16 ปีขึ้นไป ความโรแมนติกระดับน่ารัก (แซว จีบ จับมือ กอด) ไม่มีฉากเชิงเพศและไม่มีความรุนแรง · มีอาหารทะเล แมลงปูและน้ำทะเลเยอะ</div>`;
  const b1 = el('button','btn','🌺 เริ่มเรื่อง'); b1.onclick = showCreate;
  const b2 = el('button','btn alt','📂 เล่นต่อ / โหลด'); b2.onclick = () => openSaves('load'); b2.disabled = !hasSave;
  const b3 = el('button','btn ghost small','📖 คู่มือ'); b3.onclick = openHelp;
  const b4 = el('button','btn ghost small','⚠️ คำเตือนเนื้อหา'); b4.onclick = () => openModal('⚠️ คำเตือนเนื้อหา', el('div','', '<p>เกมนี้เป็นนิยายเบา ๆ แนวโรงเรียนมัธยมปลาย ตัวละครทุกคนอายุ 16 ปีขึ้นไป ความรักในเกมเป็นแบบน่ารักตามวัย ไม่มีเนื้อหาเชิงเพศ ไม่มีความรุนแรง</p><p>มีมุกเกี่ยวกับความกลัวน้ำ/การจมน้ำเล็กน้อย (ตลกเบา ๆ ไม่มีอันตรายจริง) และฉากอาหารทะเล</p><p>ตัวละคร สถานที่ และเหตุการณ์ทั้งหมดเป็นเรื่องแต่ง</p>'));
  const b5 = el('button','btn ghost small','📒 สะสม/ฉากจบ'); b5.onclick = () => { setS(newState()); openCollection(); setS(null); };
  const b6 = el('button','btn ghost small','⚙️ ตั้งค่า'); b6.onclick = openSettings;
  const row = el('div'); row.append(b3,b4,b5,b6);
  c.append(b1,b2,row); st.appendChild(c);
}

function showCreate(){
  const P = {name:'', nick:'', persona:'wit', look:{body:CFG.look.body[1], hair:CFG.look.hair[0], hairColor:CFG.look.hairColor[1], skin:CFG.look.skin[1], eyes:CFG.look.eyes[1], style:CFG.look.style[0]}, interest:'music'};
  const st = $('#stage'); st.className = 'card bg-plain'; st.innerHTML = '';
  const c = el('div','cc'); st.appendChild(c);
  c.innerHTML = `<h2 class="hand">✿ ตั้งค่าตัวเอก ✿</h2><p class="muted">ตัวเอกเป็นผู้หญิงเสมอ ตั้งชื่อและเลือกหน้าตาได้ตามใจ บุคลิกที่เลือกแค่เปลี่ยนคำพูดและปฏิกิริยา ไม่ล็อกเนื้อเรื่องใด ๆ</p>
  <h3>ชื่อ</h3><input type="text" id="inName" maxlength="20" placeholder="ชื่อ (เช่น ฟ้าใส)"><br><br><input type="text" id="inNick" maxlength="12" placeholder="ชื่อเล่นที่ใช้ในเกม (เว้นว่าง = ใช้ชื่อ)">
  <h3>บุคลิก</h3><div id="ps"></div>`;
  const ps = $('#ps', c);
  const drawP = () => { ps.innerHTML = ''; CFG.personas.forEach(p => { const b = el('button','persona'+(P.persona===p.id?' sel':''), `<b>${p.name}</b><small>${p.desc}</small>`); b.onclick = () => { P.persona = p.id; drawP(); }; ps.appendChild(b); }); }; drawP();
  const chipRow = (label, key, opts, obj) => { c.appendChild(el('h3','',label)); const d = el('div','chips'); const draw = () => { d.innerHTML=''; opts.forEach(o => { const val = typeof o==='string'?o:o.id, txt = typeof o==='string'?o:o.name; const b = el('button','chip'+((obj?obj[key]:P[key])===val?' sel':''), txt); b.onclick = () => { (obj||P)[key] = val; draw(); }; d.appendChild(b); }); }; draw(); c.appendChild(d); };
  chipRow('รูปร่าง','body',CFG.look.body,P.look); chipRow('ทรงผม','hair',CFG.look.hair,P.look); chipRow('สีผม','hairColor',CFG.look.hairColor,P.look);
  chipRow('สีผิว','skin',CFG.look.skin,P.look); chipRow('สีตา','eyes',CFG.look.eyes,P.look); chipRow('สไตล์การแต่งตัว','style',CFG.look.style,P.look);
  chipRow('ความสนใจ/ความถนัด','interest',CFG.interests,null);
  const go1 = el('button','btn','🌴 เริ่มบทนำ'); const wrap = el('div','center'); wrap.appendChild(go1); c.appendChild(wrap);
  go1.onclick = () => {
    const name = $('#inName').value.trim(); if(!name){ toast('ใส่ชื่อก่อนนะ'); return; }
    startGame({name, nick:$('#inNick').value.trim()||name, persona:P.persona, look:P.look, interest:P.interest});
  };
  window.scrollTo({top:0});
}

function startGame(p){
  META.plays++; saveJSON('meta', META);
  const s = newState(); Object.assign(s, {name:p.name, nick:p.nick, persona:p.persona, look:p.look, interest:p.interest}); setS(s);
  const per = CFG.personas.find(x => x.id === p.persona); applyFx({stat:per.bonus});
  const it = CFG.interests.find(x => x.id === p.interest); applyFx(it.fx ? {stat:it.fx} : null);
  S.stat.energy = Math.min(S.stat.energy, 100); S.freeDays = 0;
  $('#toasts').innerHTML = '';
  renderScene('ch01.intro');
}

/* ===================== เริ่มระบบ ===================== */
G.boot = function(){
  META = Object.assign(META, loadJSON('meta', {})); SET = Object.assign(SET, loadJSON('settings', {}));
  applySettings(); showTitle();
  $('#btnMenu').onclick = () => S ? openMenu() : openSettings();
  document.querySelectorAll('#bar button').forEach(b => b.onclick = () => ({log:openLog, profile:openProfile, rel:openRel, phone:openPhone, menu:openMenu})[b.dataset.m]());
  setInterval(() => { if(S && !document.hidden) S.playMs += 5000; }, 5000);
};
})();
