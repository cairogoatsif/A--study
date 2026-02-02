/* Study Lab app.js
   - Modes: Flashcards, Matching, Quiz
   - Data stored in `cardsData` below; admin can edit JSON to add or change cards.
   - Progress saved in localStorage under key 'studylab_progress'
*/

/* ---------- Data ---------- */
/* Weighted topics and sample cards derived from your list.
   Each card: {id, topic, subtopic, difficulty, front, back}
*/
const defaultCards = [
  /* Mobile devices 13% */
  {id:'m1', topic:'Mobile devices', subtopic:'Hardware setup', difficulty:'easy',
   front:'Install a removable battery safely', back:'Power off device; remove back cover; align contacts; insert battery; secure cover.'},
  {id:'m2', topic:'Mobile devices', subtopic:'Accessory options', difficulty:'medium',
   front:'Configure Bluetooth pairing', back:'Enable Bluetooth on both devices; make device discoverable; select device and confirm PIN.'},
  {id:'m3', topic:'Mobile devices', subtopic:'Network setup', difficulty:'medium',
   front:'Sync contacts between phone and cloud', back:'Enable account sync in settings; choose contacts; force sync; verify on cloud.'},
  {id:'m4', topic:'Mobile devices', subtopic:'Troubleshooting', difficulty:'hard',
   front:'Phone cannot connect to Wi‑Fi but others can', back:'Forget network and rejoin; reboot router and phone; check DHCP; check MAC filter.'},

  /* Networking 23% */
  {id:'n1', topic:'Networking', subtopic:'Protocols and ports', difficulty:'easy',
   front:'Which port does HTTP use by default?', back:'Port 80 for HTTP; 443 for HTTPS.'},
  {id:'n2', topic:'Networking', subtopic:'SOHO networks', difficulty:'medium',
   front:'Basic steps to set up a SOHO router', back:'Connect WAN, configure SSID and password, set DHCP range, secure admin, enable firewall.'},
  {id:'n3', topic:'Networking', subtopic:'Networking tools', difficulty:'hard',
   front:'Use of a cable tester', back:'Verify continuity, pair order, and detect shorts on Ethernet cables.'},

  /* Hardware 25% */
  {id:'h1', topic:'Hardware', subtopic:'Component installation', difficulty:'easy',
   front:'How to install RAM modules', back:'Match notch, align pins, insert at angle, press down until clips click.'},
  {id:'h2', topic:'Hardware', subtopic:'Cables and connectors', difficulty:'medium',
   front:'Difference between HDMI and DisplayPort', back:'Both carry video/audio; DP supports higher bandwidth and daisy-chaining.'},
  {id:'h3', topic:'Hardware', subtopic:'Motherboards and power', difficulty:'hard',
   front:'Check PSU compatibility with motherboard', back:'Confirm ATX connector types, wattage, CPU power connectors, and case form factor.'},

  /* Virtualization and cloud computing 11% */
  {id:'v1', topic:'Virtualization and cloud computing', subtopic:'Virtualization concepts', difficulty:'medium',
   front:'What is a hypervisor?', back:'Software that creates and runs virtual machines; Type 1 runs on hardware, Type 2 runs on host OS.'},
  {id:'v2', topic:'Virtualization and cloud computing', subtopic:'Cloud models', difficulty:'easy',
   front:'Define IaaS, PaaS, SaaS', back:'IaaS: infrastructure; PaaS: platform; SaaS: software delivered over the web.'},

  /* Troubleshooting 28% */
  {id:'t1', topic:'Hardware and network troubleshooting', subtopic:'Diagnosing issues', difficulty:'medium',
   front:'First step when a PC won’t power on', back:'Check power cable, PSU switch, motherboard LEDs, reseat power connectors.'},
  {id:'t2', topic:'Hardware and network troubleshooting', subtopic:'Troubleshooting tools', difficulty:'hard',
   front:'Use of a loopback plug', back:'Test serial or network ports by looping transmit to receive to verify port functionality.'}
];

/* ---------- Persistence ---------- */
const STORAGE_PROGRESS = 'studylab_progress';
const STORAGE_CARDS = 'studylab_cards';

function loadCards(){
  try{
    const raw = localStorage.getItem(STORAGE_CARDS);
    return raw ? JSON.parse(raw) : defaultCards;
  } catch(e){ return defaultCards; }
}
function saveCards(cards){
  localStorage.setItem(STORAGE_CARDS, JSON.stringify(cards));
}

/* Progress structure: { known: Set(ids), quizHigh: number, perTopic: {topic:score} } */
function loadProgress(){
  try{
    const raw = localStorage.getItem(STORAGE_PROGRESS);
    if(!raw) return {known:[], quizHigh:0, perTopic:{}};
    return JSON.parse(raw);
  } catch(e){ return {known:[], quizHigh:0, perTopic:{}}; }
}
function saveProgress(p){ localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(p)); }

/* ---------- App State ---------- */
let cards = loadCards();
let progress = loadProgress();
let currentMode = 'flash';
let currentTopic = 'All';
let filtered = [];
let flashIndex = 0;
let showingBack = false;
let quizState = null;

/* ---------- UI Elements ---------- */
const topicSelect = document.getElementById('topic-select');
const difficultySelect = document.getElementById('difficulty');
const quizCountInput = document.getElementById('quiz-count');
const startBtn = document.getElementById('start-btn');
const resetProgressBtn = document.getElementById('reset-progress');

const modeButtons = document.querySelectorAll('.mode-btn');
const flashArea = document.getElementById('flash-area');
const matchArea = document.getElementById('match-area');
const quizArea = document.getElementById('quiz-area');

const cardEl = document.getElementById('card');
const cardFront = document.getElementById('card-front');
const cardBack = document.getElementById('card-back');
const flipBtn = document.getElementById('flip-card');
const prevBtn = document.getElementById('prev-card');
const nextBtn = document.getElementById('next-card');
const markKnownBtn = document.getElementById('mark-known');

const matchBoard = document.getElementById('match-board');
const shuffleMatchBtn = document.getElementById('shuffle-match');
const checkMatchBtn = document.getElementById('check-match');

const qIndex = document.getElementById('q-index');
const qTotal = document.getElementById('q-total');
const qScore = document.getElementById('q-score');
const questionEl = document.getElementById('question');
const answersEl = document.getElementById('answers');
const nextQuestionBtn = document.getElementById('next-question');
const endQuizBtn = document.getElementById('end-quiz');

const progressList = document.getElementById('progress-list');

const openAdminBtn = document.getElementById('open-admin');
const adminPanel = document.getElementById('admin');
const adminJson = document.getElementById('admin-json');
const saveAdminBtn = document.getElementById('save-admin');
const cancelAdminBtn = document.getElementById('cancel-admin');

/* ---------- Helpers ---------- */
function uniqueTopics(cards){
  const set = new Set(cards.map(c=>c.topic));
  return ['All', ...Array.from(set)];
}
function filterCards(){
  const topic = currentTopic;
  const diff = difficultySelect.value;
  filtered = cards.filter(c => (topic==='All' || c.topic===topic) && (diff==='any' || c.difficulty===diff));
  return filtered;
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ---------- Mode Switching ---------- */
function setMode(mode){
  currentMode = mode;
  modeButtons.forEach(b => b.setAttribute('aria-pressed', b.id.endsWith(mode) ? 'true' : 'false'));
  flashArea.hidden = mode !== 'flash';
  matchArea.hidden = mode !== 'match';
  quizArea.hidden = mode !== 'quiz';
}

/* ---------- Flashcards ---------- */
function renderFlash(){
  filterCards();
  if(filtered.length===0){
    cardFront.textContent = 'No cards for this selection';
    cardBack.textContent = '';
    return;
  }
  const c = filtered[flashIndex % filtered.length];
  cardFront.textContent = c.front;
  cardBack.textContent = c.back;
  showingBack = false;
  cardEl.classList.remove('flipped');
}
function flipCard(){
  showingBack = !showingBack;
  cardEl.classList.toggle('flipped', showingBack);
}
function prevCard(){ flashIndex = (flashIndex - 1 + filtered.length) % filtered.length; renderFlash(); }
function nextCard(){ flashIndex = (flashIndex + 1) % filtered.length; renderFlash(); }
function markKnown(){
  const id = filtered[flashIndex % filtered.length].id;
  if(!progress.known.includes(id)) progress.known.push(id);
  saveProgress(progress);
  renderProgress();
}

/* ---------- Matching ---------- */
function buildMatch(){
  filterCards();
  matchBoard.innerHTML = '';
  if(filtered.length < 2){ matchBoard.textContent = 'Not enough cards to match.'; return; }
  // Build pairs: left = front, right = back (shuffled)
  const pairs = filtered.slice(0, Math.min(6, filtered.length)); // limit to 6 pairs for UI
  const left = pairs.map(p => ({id:p.id, text:p.front}));
  const right = pairs.map(p => ({id:p.id, text:p.back}));
  shuffle(right);
  const leftCol = document.createElement('div'); leftCol.className='match-col';
  const rightCol = document.createElement('div'); rightCol.className='match-col';
  left.forEach(item=>{
    const el = document.createElement('div'); el.className='match-item'; el.draggable=true;
    el.textContent = item.text; el.dataset.id = item.id;
    el.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', item.id); });
    leftCol.appendChild(el);
  });
  right.forEach(item=>{
    const el = document.createElement('div'); el.className='match-item droppable';
    el.textContent = item.text; el.dataset.id = item.id;
    el.addEventListener('dragover', e=>e.preventDefault());
    el.addEventListener('drop', e=>{
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      el.dataset.matched = draggedId;
      el.style.outline = '2px dashed var(--accent)';
    });
    rightCol.appendChild(el);
  });
  matchBoard.appendChild(leftCol); matchBoard.appendChild(rightCol);
}
function checkMatch(){
  const droppables = matchBoard.querySelectorAll('.droppable');
  let correct = 0, total = droppables.length;
  droppables.forEach(d=>{
    if(d.dataset.matched && d.dataset.matched === d.dataset.id) { correct++; d.style.background='rgba(46,204,113,0.08)'; }
    else d.style.background='rgba(231,76,60,0.06)';
  });
  alert(`Matched ${correct} / ${total}`);
}

/* ---------- Quiz ---------- */
function startQuiz(){
  filterCards();
  const count = Math.max(3, Math.min(30, parseInt(quizCountInput.value,10) || 10));
  const pool = shuffle(filtered.slice());
  const questions = pool.slice(0, Math.min(count, pool.length)).map(c => {
    // Build 3 distractors from other cards' backs
    const others = cards.filter(x=>x.id!==c.id);
    shuffle(others);
    const choices = [c.back, ...(others.slice(0,3).map(o=>o.back))];
    return {id:c.id, q:c.front, correct:c.back, choices:shuffle(choices).slice(0,4)};
  });
  quizState = {questions, index:0, score:0};
  qTotal.textContent = questions.length;
  qIndex.textContent = 1;
  qScore.textContent = 0;
  renderQuestion();
}
function renderQuestion(){
  const qs = quizState.questions[quizState.index];
  questionEl.textContent = qs.q;
  answersEl.innerHTML = '';
  qs.choices.forEach((ch, i)=>{
    const btn = document.createElement('button'); btn.className='answer-btn'; btn.textContent = ch; btn.setAttribute('role','listitem');
    btn.addEventListener('click', ()=>{
      // disable all
      Array.from(answersEl.children).forEach(b=>b.disabled=true);
      if(ch === qs.correct){
        btn.classList.add('correct'); quizState.score++;
        qScore.textContent = quizState.score;
      } else {
        btn.classList.add('wrong');
        // highlight correct
        Array.from(answersEl.children).forEach(b=>{ if(b.textContent===qs.correct) b.classList.add('correct'); });
      }
      nextQuestionBtn.disabled = false;
    });
    answersEl.appendChild(btn);
  });
  nextQuestionBtn.disabled = true;
}
function nextQuestion(){
  quizState.index++;
  if(quizState.index >= quizState.questions.length){ endQuiz(); return; }
  qIndex.textContent = quizState.index + 1;
  renderQuestion();
}
function endQuiz(){
  // update high score
  if(quizState.score > (progress.quizHigh || 0)) { progress.quizHigh = quizState.score; saveProgress(progress); }
  alert(`Quiz finished. Score: ${quizState.score} / ${quizState.questions.length}`);
  quizState = null;
  renderProgress();
}

/* ---------- Progress UI ---------- */
function renderProgress(){
  progressList.innerHTML = '';
  const knownCount = progress.known ? progress.known.length : 0;
  const total = cards.length;
  const p = document.createElement('div'); p.innerHTML = `<div class="small">Known cards: <strong>${knownCount}</strong> / ${total}</div>`;
  const high = document.createElement('div'); high.className='small'; high.textContent = `Quiz high score: ${progress.quizHigh || 0}`;
  progressList.appendChild(p); progressList.appendChild(high);
}

/* ---------- Admin ---------- */
function openAdmin(){
  adminPanel.hidden = false;
  adminJson.value = JSON.stringify(cards, null, 2);
}
function saveAdmin(){
  try{
    const parsed = JSON.parse(adminJson.value);
    if(!Array.isArray(parsed)) throw new Error('JSON must be an array of cards');
    cards = parsed;
    saveCards(cards);
    adminPanel.hidden = true;
    populateTopics();
    alert('Saved cards.');
  } catch(e){ alert('Invalid JSON: ' + e.message); }
}

/* ---------- Wiring ---------- */
function populateTopics(){
  topicSelect.innerHTML = '';
  uniqueTopics(cards).forEach(t=>{
    const opt = document.createElement('option'); opt.value = t; opt.textContent = t; topicSelect.appendChild(opt);
  });
}
modeButtons.forEach(b=>{
  b.addEventListener('click', ()=> setMode(b.id.replace('mode-','')));
});
startBtn.addEventListener('click', ()=>{
  currentTopic = topicSelect.value;
  filterCards();
  if(currentMode === 'flash'){ flashIndex = 0; renderFlash(); }
  if(currentMode === 'match'){ buildMatch(); }
  if(currentMode === 'quiz'){ startQuiz(); }
});
resetProgressBtn.addEventListener('click', ()=>{
  if(confirm('Reset all progress?')){ progress = {known:[], quizHigh:0, perTopic:{}}; saveProgress(progress); renderProgress(); }
});
flipBtn.addEventListener('click', flipCard);
cardEl.addEventListener('click', flipCard);
prevBtn.addEventListener('click', ()=>{ prevCard(); });
nextBtn.addEventListener('click', ()=>{ nextCard(); });
markKnownBtn.addEventListener('click', markKnown);

shuffleMatchBtn.addEventListener('click', ()=> buildMatch());
checkMatchBtn.addEventListener('click', checkMatch);

nextQuestionBtn.addEventListener('click', nextQuestion);
endQuizBtn.addEventListener('click', ()=>{ if(confirm('End quiz early?')) endQuiz(); });

openAdminBtn.addEventListener('click', openAdmin);
saveAdminBtn.addEventListener('click', saveAdmin);
cancelAdminBtn.addEventListener('click', ()=>{ adminPanel.hidden=true; });

/* Keyboard shortcuts */
window.addEventListener('keydown', e=>{
  if(e.key === ' ' && currentMode === 'flash'){ e.preventDefault(); flipCard(); }
  if(e.key === 'ArrowRight' && currentMode === 'flash') nextCard();
  if(e.key === 'ArrowLeft' && currentMode === 'flash') prevCard();
  if(e.key === 'Enter' && currentMode === 'quiz' && quizState) nextQuestion();
});

/* Init */
function init(){
  cards = loadCards();
  progress = loadProgress();
  populateTopics();
  renderProgress();
  setMode('flash');
  filterCards();
  renderFlash();
}
init();
