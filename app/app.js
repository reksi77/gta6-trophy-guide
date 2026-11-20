// GTA 6 Trophy Guide — tracker, filters, spoiler mode, count trackers, export/import.
// All progress lives in localStorage; the app fetches only its own data/trophies.json.
const STORE_KEY = 'gta6-trophy-guide-v1';
const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
const KIND_LABELS = {
  all: 'All', story: 'Story', missable: 'Missable',
  collectibles: 'Collectibles', activities: 'Activities', online: 'Online', platinum: 'Platinum',
};

const $ = (id) => document.getElementById(id);
const listEl = $('trophyList');
const trackerGrid = $('trackerGrid');
const roadmapList = $('roadmapList');
const sourceMatrix = $('sourceMatrix');
const searchBox = $('searchBox');
const kindChips = $('kindChips');
const gradeSelect = $('gradeSelect');
const sortSelect = $('sortSelect');
const spoilerToggle = $('spoilerToggle');
const earnedToggle = $('earnedToggle');

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));

let saved = { earned: [], counts: {} };
try { saved = { ...saved, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') }; } catch { /* corrupted save: start fresh */ }
const earned = new Set(saved.earned.filter((id) => byId.has(id)));
const counts = { ...saved.counts };
for (const tr of doc.trackers) if (typeof counts[tr.id] !== 'number') counts[tr.id] = 0;

let kindFilter = 'all';

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify({ earned: [...earned], counts }));
}

function fmt(n) { return n.toLocaleString('en-US'); }

function trophyCount(t) {
  return t.count ?? doc.trackers.find((tr) => tr.trophyId === t.id) ?? null;
}

function renderHero() {
  const p = doc.platinum;
  $('platinumFacts').textContent =
    `Difficulty ${p.difficulty} (PowerPyx) · ${p.hours} hours · ${p.playthroughs} playthrough · ` +
    `${p.online} online trophies · ${p.cheats}`;
  const miss = trophies.find((t) => t.missable);
  $('missableText').textContent = miss
    ? ` ${miss.name} — meditate at every spot, and do the Chapter 1 session at Jason's house the moment Lucia offers it. It cannot be done after Chapter 1 ends.`
    : '';
}

function renderRoadmap() {
  roadmapList.replaceChildren();
  for (const stage of doc.roadmap) {
    const li = document.createElement('li');
    const h = document.createElement('h3');
    h.textContent = `Stage ${stage.stage}: ${stage.title}`;
    const hrs = document.createElement('p');
    hrs.className = 'hours';
    hrs.textContent = stage.hours;
    const text = document.createElement('p');
    text.textContent = stage.text;
    li.append(h, hrs, text);
    roadmapList.append(li);
  }
}

function renderChips() {
  kindChips.replaceChildren();
  const kinds = ['all', 'story', 'missable', 'collectibles', 'activities', 'online', 'platinum'];
  for (const kind of kinds) {
    const n = kind === 'all' ? trophies.length : trophies.filter((t) => t.kind === kind).length;
    if (kind !== 'all' && n === 0) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.setAttribute('aria-pressed', String(kindFilter === kind));
    b.textContent = `${KIND_LABELS[kind]} (${n})`;
    b.addEventListener('click', () => { kindFilter = kind; renderAll(); });
    kindChips.append(b);
  }
}

function renderTrackers() {
  trackerGrid.replaceChildren();
  for (const tr of doc.trackers) {
    const done = counts[tr.id] >= tr.target;
    const card = document.createElement('div');
    card.className = 'tracker' + (done ? ' done' : '');
    const label = document.createElement('div');
    label.className = 't-label';
    label.textContent = tr.label;
    const count = document.createElement('div');
    count.className = 't-count';
    count.textContent = `${fmt(counts[tr.id])} / ${fmt(tr.target)}` + (tr.total > tr.target ? ` (of ${fmt(tr.total)})` : '');
    const note = document.createElement('div');
    note.className = 't-note';
    note.textContent = tr.note + (done ? ' — target reached, trophy checked.' : '');
    const btns = document.createElement('div');
    btns.className = 't-btns';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.setAttribute('aria-label', `Decrease ${tr.label}`);
    minus.addEventListener('click', () => { counts[tr.id] = Math.max(0, counts[tr.id] - tr.step); syncTracker(tr); });
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.setAttribute('aria-label', `Increase ${tr.label}`);
    plus.addEventListener('click', () => { counts[tr.id] = Math.min(tr.total, counts[tr.id] + tr.step); syncTracker(tr); });
    btns.append(minus, plus);
    card.append(label, count, note, btns);
    trackerGrid.append(card);
  }
}

function syncTracker(tr) {
  persist();
  const trophy = byId.get(tr.trophyId);
  // Reaching a counter's target checks its trophy off. Dropping back below the
  // target never unchecks it: an earned trophy stays earned, even if the
  // player re-counts. (The old code un-checked a trophy the player had ticked
  // by hand whenever its counter dipped below target.)
  if (trophy && counts[tr.id] >= tr.target) earned.add(trophy.id);
  renderAll();
}

function sourceLinks(t) {
  return t.sources.map((key) => {
    const s = doc.sources[key];
    return s ? { name: s.name, url: s.url } : { name: key, url: '' };
  });
}

function trophyVisible(t) {
  const q = searchBox.value.trim().toLowerCase();
  if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
  if (gradeSelect.value !== 'all' && t.grade !== gradeSelect.value) return false;
  if (earnedToggle.checked && !earned.has(t.id)) return false;
  if (q) {
    const hay = `${t.name} ${t.description} ${t.guide} ${t.chapter ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function sortedTrophies(list) {
  const arr = [...list];
  if (sortSelect.value === 'grade') arr.sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.id - b.id);
  else if (sortSelect.value === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortSelect.value === 'unearned') arr.sort((a, b) => (earned.has(a.id) ? 1 : 0) - (earned.has(b.id) ? 1 : 0) || a.id - b.id);
  else arr.sort((a, b) => a.id - b.id);
  return arr;
}

function renderList() {
  listEl.replaceChildren();
  const visible = sortedTrophies(trophies.filter(trophyVisible));
  $('resultCount').textContent = `Showing ${visible.length} of ${trophies.length} trophies · ${earned.size} earned`;
  const spoilerOn = spoilerToggle.checked;
  for (const t of visible) {
    const isEarned = earned.has(t.id);
    const hidden = spoilerOn && t.spoiler && !isEarned;
    const card = document.createElement('article');
    card.className = 'trophy' + (isEarned ? ' earned' : '') + (hidden ? ' spoiled' : '');
    card.id = `trophy-${t.id}`;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isEarned;
    box.setAttribute('aria-label', `Mark ${t.name} as earned`);
    box.addEventListener('change', () => {
      if (box.checked) earned.add(t.id);
      else earned.delete(t.id);
      persist();
      renderAll();
    });
    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 't-head';
    const name = document.createElement('h3');
    name.className = 't-name';
    name.textContent = hidden ? 'Hidden story trophy' : t.name;
    const grade = document.createElement('span');
    grade.className = `grade ${t.grade}`;
    grade.textContent = t.grade;
    head.append(name, grade);
    if (t.missable) {
      const b = document.createElement('span');
      b.className = 'badge missable';
      b.textContent = 'Missable';
      head.append(b);
    }
    if (t.status === 'unconfirmed') {
      const b = document.createElement('span');
      b.className = 'badge unconfirmed';
      b.textContent = 'Unconfirmed';
      head.append(b);
    }
    if (t.hidden) {
      const b = document.createElement('span');
      b.className = 'badge hidden';
      b.textContent = 'Hidden on PS5';
      head.append(b);
    }
    body.append(head);
    if (t.chapter) {
      const ch = document.createElement('p');
      ch.className = 'chapter';
      ch.textContent = t.chapter === 5 ? 'Finale' : `Chapter ${t.chapter}`;
      body.append(ch);
    }
    const official = document.createElement('p');
    official.className = 'official';
    official.textContent = hidden ? 'Story trophy — earn it to reveal the name and description.' : `“${t.description}” — official description`;
    body.append(official);
    if (hidden) {
      const note = document.createElement('p');
      note.className = 'spoiler-note';
      note.textContent = 'Spoiler-safe mode is on: check the box once you have earned this trophy to reveal its guide.';
      body.append(note);
    } else {
      const guide = document.createElement('p');
      guide.className = 'guide';
      const strong = document.createElement('strong');
      strong.textContent = 'How to get it: ';
      guide.append(strong, document.createTextNode(t.guide));
      body.append(guide);
      const c = trophyCount(t);
      if (c) {
        const cl = document.createElement('p');
        cl.className = 'countline';
        cl.textContent = `Target: ${fmt(c.target)}${c.total > c.target ? ` of ${fmt(c.total)}` : ''} — ${c.label}. Use the counter above.`;
        body.append(cl);
      }
      if (t.note) {
        const n = document.createElement('p');
        n.className = 'note';
        n.textContent = t.note;
        body.append(n);
      }
      const srcs = document.createElement('p');
      srcs.className = 'sources';
      srcs.textContent = 'Sources: ';
      sourceLinks(t).forEach((s, i) => {
        if (i) srcs.append(document.createTextNode(' · '));
        if (s.url) {
          const a = document.createElement('a');
          a.href = s.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = s.name;
          srcs.append(a);
        } else {
          srcs.append(document.createTextNode(s.name));
        }
      });
      body.append(srcs);
    }
    card.append(box, body);
    listEl.append(card);
  }
}

function renderSources() {
  sourceMatrix.replaceChildren();
  const counts = {};
  for (const t of trophies) for (const key of t.sources) counts[key] = (counts[key] ?? 0) + 1;
  const rows = Object.entries(doc.sources)
    .map(([key, s]) => ({ key, ...s, n: counts[key] ?? 0 }))
    .sort((a, b) => b.n - a.n);
  for (const row of rows) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    const a = document.createElement('a');
    a.href = row.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = row.name;
    name.append(a);
    const num = document.createElement('td');
    num.className = 'num';
    num.textContent = String(row.n);
    tr.append(name, num);
    sourceMatrix.append(tr);
  }
}

function renderProgress() {
  const pct = Math.round((earned.size / trophies.length) * 100);
  $('progressFill').style.width = `${pct}%`;
  $('progressText').textContent = `${earned.size} / ${trophies.length} trophies earned (${pct}%)` +
    (earned.size === trophies.length ? ' — Platinum! You are a Leonida Legend.' : '');
}

function renderAll() {
  renderHero();
  renderRoadmap();
  renderChips();
  renderTrackers();
  renderList();
  renderSources();
  renderProgress();
}

function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('exportBtn').addEventListener('click', () => {
  download('gta6-trophy-progress.json', JSON.stringify({
    game: doc.game, exportedAt: new Date().toISOString(),
    earned: [...earned].sort((a, b) => a - b), counts,
  }, null, 2));
});
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned ?? [];
    const next = new Set(ids.filter((id) => byId.has(id)));
    earned.clear();
    for (const id of next) earned.add(id);
    if (data.counts) for (const tr of doc.trackers) {
      if (typeof data.counts[tr.id] === 'number') counts[tr.id] = Math.max(0, Math.min(tr.total, data.counts[tr.id]));
    }
    persist();
    renderAll();
  } catch {
    alert('That file is not valid progress JSON.');
  }
  e.target.value = '';
});
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Reset all progress and counters?')) return;
  earned.clear();
  for (const tr of doc.trackers) counts[tr.id] = 0;
  persist();
  renderAll();
});
searchBox.addEventListener('input', renderList);
gradeSelect.addEventListener('change', renderAll);
sortSelect.addEventListener('change', renderList);
spoilerToggle.addEventListener('change', renderList);
earnedToggle.addEventListener('change', renderList);

renderAll();

// Deep links: ?open=<trophy id> scrolls to the trophy; ?kind=<kind> and
// ?grade=<grade> pre-select a filter, so a view can be linked to directly.
const params = new URLSearchParams(location.search);
const kindParam = params.get('kind');
if (kindParam && kindParam in KIND_LABELS) {
  kindFilter = kindParam;
  renderAll();
}
const gradeParam = params.get('grade');
if (gradeParam && [...gradeSelect.options].some((o) => o.value === gradeParam)) {
  gradeSelect.value = gradeParam;
  renderAll();
}
const openId = Number(params.get('open'));
if (openId && byId.has(openId)) {
  const el = document.getElementById(`trophy-${openId}`);
  if (el) el.scrollIntoView({ block: 'center' });
}
