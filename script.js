// Bingo da Ivany V3 - JavaScript
(()=>{
'use strict';
window.addEventListener('error',()=>{const n=document.querySelector('.tiny-note');if(n&&!window.BingoIvanyStart){n.textContent='O navegador bloqueou o jogo. Abra o endereço publicado diretamente no Safari.';n.style.color='#b42347';n.style.fontWeight='900'}});

const STORAGE_KEY='bingo-da-ivany-v3',DEFAULT_INTERVAL=5000,HINT_DELAY=1800,VIRTUAL_NAMES=['Ana','José','Maria','Carlos','Teresa','Paulo','Lúcia','João','Cida'];
const els={
soundBtn:document.getElementById('soundBtn'),currentBall:document.getElementById('currentBall'),heroTitle:document.getElementById('heroTitle'),heroMessage:document.getElementById('heroMessage'),countdownBar:document.getElementById('countdownBar'),drawnCount:document.getElementById('drawnCount'),markedCount:document.getElementById('markedCount'),missingCount:document.getElementById('missingCount'),missingLabel:document.getElementById('missingLabel'),ticketCode:document.getElementById('ticketCode'),ticketSectionTitle:document.getElementById('ticketSectionTitle'),ticketsWrap:document.getElementById('ticketsWrap'),speedSlider:document.getElementById('speedSlider'),speedValueLabel:document.getElementById('speedValueLabel'),repeatBtn:document.getElementById('repeatBtn'),playersSummary:document.getElementById('playersSummary'),historyRow:document.getElementById('historyRow'),modeLabel:document.getElementById('modeLabel'),milestone1:document.getElementById('milestone1'),milestone2:document.getElementById('milestone2'),milestone3:document.getElementById('milestone3'),newGameBtn:document.getElementById('newGameBtn'),mainBtn:document.getElementById('mainBtn'),welcomeOverlay:document.getElementById('welcomeOverlay'),welcomePlayBtn:document.getElementById('welcomePlayBtn'),resumeBtn:document.getElementById('resumeBtn'),escolhaOverlay:document.getElementById('escolhaOverlay'),escolhaAutoBtn:document.getElementById('escolhaAutoBtn'),escolhaManualBtn:document.getElementById('escolhaManualBtn'),celebrationOverlay:document.getElementById('celebrationOverlay'),celebrationIcon:document.getElementById('celebrationIcon'),celebrationTitle:document.getElementById('celebrationTitle'),celebrationText:document.getElementById('celebrationText'),celebrationContinueBtn:document.getElementById('celebrationContinueBtn'),playersPanel:document.getElementById('playersPanel'),playersHeader:document.getElementById('playersHeader'),playersList:document.getElementById('playersList'),toast:document.getElementById('toast'),voiceTestBtn:document.getElementById('voiceTestBtn'),voiceHint:document.getElementById('voiceHint'),stickyBar:document.getElementById('stickyBar'),stickyBall:document.getElementById('stickyBall'),stickyPending:document.getElementById('stickyPending'),victoriesNote:document.getElementById('victoriesNote')
};

let state=blankState(),autoTimer=null,countdownFrame=null,hintTimer=null,nextDrawAt=0,toastTimer=null,wakeLock=null,escolhaCount=1,startLock=false;

function blankState(){return{version:3,cartelasCount:1,ivanyCartelas:[],ivanyCartelaIds:[],markedByCartela:[],virtualPlayers:[],drawPile:[],drawn:[],mode:'manual',started:false,paused:true,sound:true,drawInterval:DEFAULT_INTERVAL,playersOpen:false,conquistas:[],conquistasClaimed:{one:0,two:0,full:0}}}
function range(s,e){return Array.from({length:e-s+1},(_,i)=>s+i)}
function shuffle(a){const arr=[...a];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function sample(a,n){return shuffle(a).slice(0,n)}
function randomFrom(a){return a[Math.floor(Math.random()*a.length)]}

function generateTicket(){
let mask,cc;
do{mask=Array.from({length:3},()=>{const c=new Set(sample(range(0,8),5));return Array.from({length:9},(_,col)=>c.has(col))});cc=Array.from({length:9},(_,col)=>mask.reduce((s,r)=>s+(r[col]?1:0),0))}while(cc.some(c=>c===0));
const t=Array.from({length:3},()=>Array(9).fill(null));
for(let col=0;col<9;col++){const min=col===0?1:col*10,max=col===8?90:col*10+9;const rows=range(0,2).filter(r=>mask[r][col]);const nums=sample(range(min,max),rows.length).sort((a,b)=>a-b);rows.forEach((r,i)=>{t[r][col]=nums[i]})}
return t;
}
function ticketToKey(t){return t.flat().filter(Number.isInteger).sort((a,b)=>a-b).join(',')}
function generateUniqueTickets(n,existingKeys){
const tickets=[],keys=new Set(existingKeys||[]);
for(let i=0;i<n;i++){let t,k,a=0;do{t=generateTicket();k=ticketToKey(t);a++}while(keys.has(k)&&a<200);keys.add(k);tickets.push({ticket:t,ticketId:String(Math.floor(100000+Math.random()*900000)),key:k})}
return tickets;
}

function completedRowsForTicket(ticket,marked){let c=0;for(const row of ticket){const nums=row.filter(Number.isInteger);if(nums.length===5&&nums.every(n=>marked.includes(n)))c++}return c}

// A Ivany só conquista linha/bingo com números MARCADOS por ela; rivais marcam automático.
// conquistasClaimed guarda o nº da bola em que o tier foi reivindicado (0 = livre),
// permitindo co-vitória quando ela completa no toque na mesma bola do rival.
function checkAllConquistas(silent){
const ball=state.drawn.length;if(ball===0)return;
const drawnSet=new Set(state.drawn),cand=[];
for(let i=0;i<state.ivanyCartelas.length;i++){const marked=state.markedByCartela[i]||[];
cand.push({rows:completedRowsForTicket(state.ivanyCartelas[i].ticket,marked),playerName:'Ivany',playerKey:'ivany_'+i,cartelaIndex:i,cartelaLabel:i+1})}
for(const vp of state.virtualPlayers){const md=vp.ticket.flat().filter(n=>Number.isInteger(n)&&drawnSet.has(n));
cand.push({rows:completedRowsForTicket(vp.ticket,md),playerName:vp.name,playerKey:'vp_'+vp.name})}
const tiers=[{type:'full',min:3},{type:'two',min:2},{type:'one',min:1}];
for(const {type,min} of tiers){
const claimedBall=state.conquistasClaimed[type];
const already=new Set(state.conquistas.filter(c=>c.type===type).map(c=>c.playerKey));
const winners=cand.filter(c=>{
if(c.rows<min||already.has(c.playerKey))return false;
if(!claimedBall)return true;
return c.playerName==='Ivany'&&claimedBall===ball;
}).map(c=>({type,playerName:c.playerName,playerKey:c.playerKey,cartelaIndex:c.cartelaIndex,cartelaLabel:c.cartelaLabel}));
if(!winners.length)continue;
for(const w of winners)state.conquistas.push(w);
if(!claimedBall){state.conquistasClaimed[type]=ball;
if(type==='full'){state.conquistasClaimed.two=state.conquistasClaimed.two||ball;state.conquistasClaimed.one=state.conquistasClaimed.one||ball}
else if(type==='two'){state.conquistasClaimed.one=state.conquistasClaimed.one||ball}}
if(!silent)showConquistaCelebration(type,winners);
break;
}
}

function showConquistaCelebration(type,winners){
state.paused=true;clearTimers();saveState();
const iw=winners.filter(w=>w.playerName==='Ivany'),vw=winners.filter(w=>w.playerName!=='Ivany'),isIv=iw.length>0,isB=type==='full';
let title,icon,text,voice;
if(isB){icon='👑';
if(isIv){const ls=iw.map(w=>'Cartela '+w.cartelaLabel).join(' e ');title='BINGO!';text='Ivany completou a '+ls+'! Hoje a coroa do bingo é toda sua.';voice='Bingo! Parabéns, Ivany! Você completou a cartela!'}
else{const ns=winners.map(w=>w.playerName).join(' e ');title='Bingo!';text=ns+' '+(winners.length>1?'fizeram':'fez')+' bingo desta vez. Vamos para outra?';voice='Bingo! '+ns+' '+(winners.length>1?'completaram':'completou')+' a cartela!'}}
else if(type==='two'){icon='🎉';
if(isIv){const ls=iw.map(w=>'Cartela '+w.cartelaLabel).join(' e ');title='DUAS LINHAS!';text='Ivany fez duas linhas na '+ls+'! A festa cresceu!';voice='Duas linhas! Parabéns, Ivany!'}
else{const ns=winners.map(w=>w.playerName).join(' e ');title='Duas Linhas!';text=ns+' '+(winners.length>1?'completaram':'completou')+' duas linhas! A disputa continua.';voice=ns+' '+(winners.length>1?'completaram':'completou')+' duas linhas!'}}
else{icon='🌟';
if(isIv){const ls=iw.map(w=>'Cartela '+w.cartelaLabel).join(' e ');title='LINHA!';text='Ivany completou uma linha na '+ls+'! Agora vamos buscar duas linhas.';voice='Linha! Muito bem, Ivany!'}
else{const ns=winners.map(w=>w.playerName).join(' e ');title='Linha!';text=ns+' '+(winners.length>1?'completaram':'completou')+' uma linha! A disputa continua.';voice=ns+' '+(winners.length>1?'completaram':'completou')+' uma linha!'}}
if(isB&&isIv)addVictory();
els.celebrationIcon.textContent=icon;els.celebrationTitle.textContent=title;els.celebrationText.textContent=text;
els.celebrationContinueBtn.textContent=isB?'Jogar novamente':'Continuar o jogo';
els.celebrationOverlay.dataset.isBingo=isB?'1':'0';
withViewTransition(()=>els.celebrationOverlay.classList.remove('hidden'));
renderMilestones();renderPlayers();renderStats();
speak(voice);launchConfetti(isB?140:isIv?65:35,isB);
}

function closeCelebrationAndContinue(){
const isB=els.celebrationOverlay.dataset.isBingo==='1';withViewTransition(()=>els.celebrationOverlay.classList.add('hidden'));
if(isB){startNewGame(state.mode||'auto');return}
if(state.mode==='auto'){state.paused=false;scheduleAutoDraw()}renderAll();saveState();
}

// Próximo objetivo da Ivany considerando a MELHOR das cartelas (marcação manual)
function missingForNextTier(){
if(!state.ivanyCartelas.length)return{count:5,label:'P/ uma linha'};
const gotOne=state.conquistas.some(c=>c.playerName==='Ivany'&&c.type==='one');
const gotTwo=state.conquistas.some(c=>c.playerName==='Ivany'&&c.type==='two');
const gotFull=state.conquistas.some(c=>c.playerName==='Ivany'&&c.type==='full');
if(gotFull)return{count:0,label:'Bingo feito!'};
const tier=gotTwo?'full':(gotOne?'two':'one');
let best=Infinity;
for(let i=0;i<state.ivanyCartelas.length;i++){
const marked=state.markedByCartela[i]||[];
const mpR=state.ivanyCartelas[i].ticket.map(row=>{const nums=row.filter(Number.isInteger);return nums.filter(n=>!marked.includes(n)).length}).sort((a,b)=>a-b);
const need=tier==='one'?mpR[0]:tier==='two'?mpR[0]+mpR[1]:mpR[0]+mpR[1]+mpR[2];
if(need<best)best=need;
}
return{count:best,label:tier==='one'?'P/ uma linha':tier==='two'?'P/ duas linhas':'P/ bingo'};
}

function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(e){}}
function loadSavedState(){try{const r=localStorage.getItem(STORAGE_KEY);if(!r)return null;const p=JSON.parse(r);if(!(p&&p.version===3&&Array.isArray(p.ivanyCartelas)&&Array.isArray(p.drawPile)))return null;
if(typeof p.drawInterval!=='number'||![3000,5000,7000].includes(p.drawInterval))p.drawInterval=DEFAULT_INTERVAL;
if(typeof p.playersOpen!=='boolean')p.playersOpen=false;
const cc=p.conquistasClaimed||{};const ball=(p.drawn&&p.drawn.length)||1;
p.conquistasClaimed={one:cc.one===true?ball:(typeof cc.one==='number'?cc.one:0),two:cc.two===true?ball:(typeof cc.two==='number'?cc.two:0),full:cc.full===true?ball:(typeof cc.full==='number'?cc.full:0)};
return p}catch(e){return null}}

function clearAutoTimers(){if(autoTimer)window.clearTimeout(autoTimer);if(countdownFrame)cancelAnimationFrame(countdownFrame);autoTimer=null;countdownFrame=null;els.countdownBar.style.width='0%'}
function clearTimers(){clearAutoTimers();if(hintTimer)window.clearTimeout(hintTimer);hintTimer=null}

function requestWakeLock(){try{if(!navigator.wakeLock||typeof navigator.wakeLock.request!=='function'||document.visibilityState!=='visible')return;const r=navigator.wakeLock.request('screen');if(!r||typeof r.then!=='function')return;r.then(l=>{wakeLock=l;if(l&&typeof l.addEventListener==='function')l.addEventListener('release',()=>{wakeLock=null})}).catch(()=>{})}catch(e){}}

function startNewGame(mode){
if(startLock)return;startLock=true;window.setTimeout(()=>{startLock=false},450);
clearTimers();
const count=escolhaCount;
const allKeys=[];
const ivanyData=generateUniqueTickets(count,allKeys);
allKeys.push(...ivanyData.map(d=>d.key));
const vpData=generateUniqueTickets(9,allKeys);
allKeys.push(...vpData.map(d=>d.key));
state={version:3,cartelasCount:count,ivanyCartelas:ivanyData,ivanyCartelaIds:ivanyData.map(d=>d.ticketId),markedByCartela:ivanyData.map(()=>[]),virtualPlayers:VIRTUAL_NAMES.map((name,i)=>({name,ticket:vpData[i].ticket,ticketId:vpData[i].ticketId})),drawPile:shuffle(range(1,90)),drawn:[],mode,sound:state.sound,drawInterval:state.drawInterval||DEFAULT_INTERVAL,playersOpen:state.playersOpen||false,started:true,paused:mode!=='auto',conquistas:[],conquistasClaimed:{one:0,two:0,full:0}};
els.escolhaOverlay.classList.add('hidden');els.welcomeOverlay.classList.add('hidden');
renderAll();saveState();requestWakeLock();
speak('Bem-vinda, Ivany. Vamos jogar!');showToast(mode==='auto'?'Sorteio automático ligado':'Você comanda o sorteio');
if(mode==='auto'){state.paused=false;renderControls();autoTimer=window.setTimeout(()=>{drawNext();scheduleAutoDraw()},1100)}
}

function resumeGame(){
const saved=loadSavedState();if(!saved)return;clearTimers();state=saved;state.paused=true;
els.welcomeOverlay.classList.add('hidden');els.escolhaOverlay.classList.add('hidden');
renderAll();saveState();requestWakeLock();showToast('Partida retomada');
}

function drawNext(){
if(!state.started||state.drawPile.length===0||state.conquistasClaimed.full)return;
clearHint();const number=state.drawPile.shift();state.drawn.push(number);animateCurrentBall(number);speak(numberAnnouncement(number));
const onAnyCartela=state.ivanyCartelas.some(ct=>ct.ticket.flat().filter(Number.isInteger).includes(number));
els.heroTitle.textContent='Número '+number;
els.heroMessage.textContent=onAnyCartela?'Ele está em uma das suas cartelas. Procure o brilho!':encouragementMessage();
renderAll();saveState();
if(onAnyCartela){hintTimer=window.setTimeout(()=>highlightAvailable(number),HINT_DELAY)}
checkAllConquistas(false);
if(state.drawPile.length===0&&!state.conquistasClaimed.full){state.paused=true;clearTimers();els.heroMessage.textContent='Todas as bolas foram sorteadas.';showToast('Fim das 90 bolas')}
}

function scheduleAutoDraw(){
clearAutoTimers();
if(state.mode!=='auto'||state.paused||state.conquistasClaimed.full||state.drawPile.length===0){renderControls();return}
nextDrawAt=performance.now()+state.drawInterval;updateCountdown();
autoTimer=window.setTimeout(()=>{drawNext();scheduleAutoDraw()},state.drawInterval);renderControls();
}

function updateCountdown(){
if(state.mode!=='auto'||state.paused){els.countdownBar.style.width='0%';return}
const remaining=Math.max(0,nextDrawAt-performance.now());const progress=100-(remaining/state.drawInterval)*100;
els.countdownBar.style.width=Math.min(100,Math.max(0,progress))+'%';
if(remaining>0)countdownFrame=requestAnimationFrame(updateCountdown);
}

function toggleMainAction(){
if(!state.started){els.escolhaOverlay.classList.remove('hidden');return}
if(state.mode==='manual'){drawNext();return}
state.paused=!state.paused;saveState();
if(state.paused){clearTimers();showToast('Sorteio pausado')}else{showToast('Sorteio retomado');scheduleAutoDraw()}renderControls();
}

function handleCellTap(number,cell,ci){
if(!Number.isInteger(number)||!state.started)return;
if(!state.drawn.includes(number)){cell.classList.remove('wrong');void cell.offsetWidth;cell.classList.add('wrong');showToast('Esse número ainda não saiu 😉');return}
const marked=state.markedByCartela[ci]||[];
if(marked.includes(number)){showToast('Esse já está marcado ✅');return}
state.markedByCartela[ci]=[...marked,number];
speak(randomFrom(['Boa!','Achou!','Mandou bem!','Na cartela!']));showToast(randomFrom(['Boa, Ivany! ✨','Achou! 🎯','Muito bem! 🌟','Número marcado! ✅']));
renderAll();saveState();
animateMark(ci,number);
checkAllConquistas(false); // com marcação manual, a conquista dela nasce no toque
}

// Carimbo na célula recém-marcada + brilho na linha se ela acabou de completar
function animateMark(ci,number){
const block=els.ticketsWrap.querySelector('[data-cartela="'+ci+'"]');if(!block)return;
const cells=[...block.querySelectorAll('.number-cell')];
const cell=cells.find(el=>el.textContent===String(number));
if(cell)cell.classList.add('just-marked');
const t=state.ivanyCartelas[ci]&&state.ivanyCartelas[ci].ticket;if(!t)return;
const row=t.find(r=>r.includes(number));if(!row)return;
const nums=row.filter(Number.isInteger);
const marked=state.markedByCartela[ci]||[];
if(nums.every(n=>marked.includes(n))){
nums.forEach(n=>{const c=cells.find(el=>el.textContent===String(n));if(c)c.classList.add('row-complete')});
}
}

function renderAll(){
renderTicket();renderHistory();renderStats();renderMilestones();renderControls();renderSound();renderSpeed();renderPlayers();
const last=state.drawn[state.drawn.length-1];const hasLast=Number.isInteger(last);
els.currentBall.textContent=hasLast?last:'–';els.currentBall.style.color=hasLast?ballColor(last):'';
els.repeatBtn.disabled=!hasLast;
updateStickyBar();
els.playersPanel.classList.toggle('collapsed',!state.playersOpen);
if(state.ivanyCartelas.length===1){els.ticketSectionTitle.textContent='Sua cartela';els.ticketCode.textContent='Cartela #'+state.ivanyCartelas[0].ticketId}
else if(state.ivanyCartelas.length>1){els.ticketSectionTitle.textContent='Suas cartelas';els.ticketCode.textContent=state.ivanyCartelas.length+' cartelas'}
}

function renderTicket(){
els.ticketsWrap.innerHTML='';
if(!state.ivanyCartelas.length){const preview=generateTicket();els.ticketsWrap.appendChild(buildCartelaBlock(preview,0,true,[],null));return}
state.ivanyCartelas.forEach((ct,i)=>{els.ticketsWrap.appendChild(buildCartelaBlock(ct.ticket,i,false,state.markedByCartela[i]||[],ct.ticketId))});
}

function buildCartelaBlock(ticket,ci,preview,marked,ticketId){
const block=document.createElement('div');block.className='cartela-block';block.dataset.cartela=String(ci);
if(!preview&&state.ivanyCartelas.length>1){
const head=document.createElement('div');head.className='cartela-block-head';
const drawnSet=new Set(state.drawn);
const pending=ticket.flat().filter(n=>Number.isInteger(n)&&drawnSet.has(n)&&!marked.includes(n)).length;
head.innerHTML='<span>Cartela '+(ci+1)+(pending>0?' <span class="pending-dot">'+pending+'</span>':'')+'</span><span class="code">#'+ticketId+'</span>';
block.appendChild(head);
}
const grid=document.createElement('div');grid.className='ticket';grid.setAttribute('role','grid');grid.setAttribute('aria-label','Cartela '+(ci+1)+' de bingo da Ivany');
ticket.forEach(row=>{row.forEach(number=>{grid.appendChild(buildCell(number,ci,preview,marked))})});
block.appendChild(grid);
return block;
}

function buildCell(number,ci,preview,marked){
const cell=document.createElement('button');cell.type='button';cell.className='number-cell';cell.setAttribute('role','gridcell');
if(!Number.isInteger(number)){cell.classList.add('blank');cell.disabled=true;cell.setAttribute('aria-label','Espaço vazio');return cell}
cell.textContent=String(number);
const isMarked=!preview&&marked.includes(number);
const isAvailable=!preview&&state.drawn.includes(number)&&!isMarked;
if(isMarked)cell.classList.add('marked');if(isAvailable)cell.classList.add('available');
cell.setAttribute('aria-label','Número '+number+(isMarked?', marcado':''));
if(!preview)cell.addEventListener('click',()=>handleCellTap(number,cell,ci));
return cell;
}

function renderPlayers(){
els.playersList.innerHTML='';
const drawnSet=new Set(state.drawn);
const allPlayers=[];
for(let i=0;i<state.ivanyCartelas.length;i++){
const ct=state.ivanyCartelas[i];const marked=state.markedByCartela[i]||[];
const rows=completedRowsForTicket(ct.ticket,marked);
allPlayers.push({name:'Ivany'+(state.ivanyCartelas.length>1?' (C'+(i+1)+')':''),marked:marked.length,total:15,rows,isIvany:true});
}
for(const vp of state.virtualPlayers){
const autoMarked=vp.ticket.flat().filter(n=>Number.isInteger(n)&&drawnSet.has(n));
const rows=completedRowsForTicket(vp.ticket,autoMarked);
allPlayers.push({name:vp.name,marked:autoMarked.length,total:15,rows,isIvany:false});
}
allPlayers.sort((a,b)=>b.marked-a.marked);
const leader=allPlayers[0];
els.playersSummary.textContent=(state.started&&leader&&state.drawn.length>0)?'👥 '+(leader.isIvany?'Você lidera!':leader.name+' lidera')+' · '+leader.marked+'/15':'👥 Jogadores na disputa';
for(const p of allPlayers){
const row=document.createElement('div');
row.className='player-row'+(p.isIvany?' ivany':'')+(p.rows>=3?' won':'');
row.innerHTML='<span>'+(p.isIvany?'⭐ ':'')+p.name+'</span><span class="player-status">'+(p.rows>=3?'BINGO! 👑':p.marked+' de '+p.total)+'</span><span class="player-bar"><i style="width:'+Math.round(p.marked/p.total*100)+'%"></i></span>';
els.playersList.appendChild(row);
}
}

function renderHistory(){
els.historyRow.innerHTML='';
if(!state.drawn.length){const e=document.createElement('span');e.className='history-empty';e.textContent='Os números sorteados aparecem aqui.';els.historyRow.appendChild(e);return}
[...state.drawn].reverse().slice(0,14).forEach(number=>{const b=document.createElement('div');b.className='mini-ball';b.textContent=String(number);b.style.background=ballColor(number);b.setAttribute('aria-label','Número sorteado '+number);els.historyRow.appendChild(b)});
}

function renderStats(){
const totalMarked=state.markedByCartela.reduce((s,m)=>s+((m&&m.length)||0),0);
const totalCells=15*Math.max(1,state.ivanyCartelas.length);
const missing=missingForNextTier();
els.drawnCount.textContent=state.drawn.length+' / 90';
els.markedCount.textContent=totalMarked+' / '+totalCells;
els.missingCount.textContent=String(missing.count);els.missingLabel.textContent=missing.label;
}

function renderMilestones(){
const hasIvanyOne=state.conquistas.some(c=>c.type==='one'&&c.playerName==='Ivany');
const hasIvanyTwo=state.conquistas.some(c=>c.type==='two'&&c.playerName==='Ivany');
const hasIvanyFull=state.conquistas.some(c=>c.type==='full'&&c.playerName==='Ivany');
const hasOtherOne=state.conquistas.some(c=>c.type==='one'&&c.playerName!=='Ivany');
const hasOtherTwo=state.conquistas.some(c=>c.type==='two'&&c.playerName!=='Ivany');
const hasOtherFull=state.conquistas.some(c=>c.type==='full'&&c.playerName!=='Ivany');
function setMs(el,isDone,isOther){el.classList.remove('done','claimed-by-other');if(isDone)el.classList.add('done');else if(isOther)el.classList.add('claimed-by-other')}
setMs(els.milestone1,hasIvanyOne,hasOtherOne);
setMs(els.milestone2,hasIvanyTwo,hasOtherTwo);
setMs(els.milestone3,hasIvanyFull,hasOtherFull);
}

function renderControls(){
if(!state.started){els.mainBtn.textContent='Começar';els.newGameBtn.disabled=true;els.modeLabel.textContent='Aguardando início';return}
els.newGameBtn.disabled=false;
if(state.conquistasClaimed.full){els.mainBtn.textContent='Jogar de novo';els.modeLabel.textContent='Bingo completo';return}
if(state.mode==='auto'){els.mainBtn.textContent=state.paused?'▶ Continuar':'⏸ Pausar';els.modeLabel.textContent=state.paused?'Automático pausado':'Modo automático'}
else{els.mainBtn.textContent='Sortear número';els.modeLabel.textContent='Modo manual'}
}

function renderSound(){els.soundBtn.textContent=state.sound?'🔊':'🔇';els.soundBtn.setAttribute('aria-label',state.sound?'Desligar voz':'Ligar voz')}

function renderSpeed(){const s=Math.round((state.drawInterval||DEFAULT_INTERVAL)/1000);els.speedSlider.value=String(s);els.speedValueLabel.textContent=s===3?'⚡ Rápida (3s)':s===7?'🐢 Lenta (7s)':'Média (5s)'}

function animateCurrentBall(number){els.currentBall.textContent=String(number);els.currentBall.style.color=ballColor(number);const wrap=els.currentBall.parentElement;els.currentBall.classList.remove('pop');wrap.classList.remove('spin');void els.currentBall.offsetWidth;els.currentBall.classList.add('pop');wrap.classList.add('spin')}

function highlightAvailable(number){
const cells=[...els.ticketsWrap.querySelectorAll('.number-cell')].filter(el=>el.textContent===String(number)&&!el.classList.contains('marked'));
cells.forEach(c=>c.classList.add('available'));
if(cells[0])cells[0].scrollIntoView({behavior:'smooth',block:'center'});
}
function clearHint(){if(hintTimer)window.clearTimeout(hintTimer);hintTimer=null}

function toggleSound(){state.sound=!state.sound;if(!state.sound)stopSpeech();renderSound();saveState();showToast(state.sound?'Voz ligada 🔊':'Voz desligada 🔇');if(state.sound)speak('Voz ligada')}

// ===== Módulo de voz resiliente (iOS Safari) =====
const synth=('speechSynthesis' in window)?window.speechSynthesis:null;
let ptVoice=null,currentUtterance=null,speakWatchdog=null,audioCtx=null,audioUnlocked=false;
function pickVoice(){if(!synth)return;const vs=synth.getVoices();ptVoice=vs.find(v=>/^pt[-_]BR$/i.test(v.lang))||vs.find(v=>/^pt/i.test(v.lang))||null}
if(synth){pickVoice();if(typeof synth.addEventListener==='function')synth.addEventListener('voiceschanged',pickVoice)}
try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
function unlockAudio(){
if(audioUnlocked)return;audioUnlocked=true;
try{const AC=window.AudioContext||window.webkitAudioContext;if(AC){audioCtx=new AC();if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{})}}catch(e){audioCtx=null}
if(synth){try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;synth.speak(u)}catch(e){}}
}
document.addEventListener('touchstart',unlockAudio,{once:true,passive:true});
document.addEventListener('click',unlockAudio,{once:true});
function playDing(){
if(!audioCtx||!state.sound)return;
try{if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;
o.type='sine';o.frequency.setValueAtTime(880,t);o.frequency.exponentialRampToValueAtTime(1320,t+.12);
g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.4,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.5);
o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+.55)}catch(e){}
}
function stopSpeech(){if(speakWatchdog){window.clearTimeout(speakWatchdog);speakWatchdog=null}if(synth){try{synth.cancel()}catch(e){}}currentUtterance=null}
function resetSpeech(){if(!synth)return;try{synth.cancel();if(synth.paused)synth.resume()}catch(e){}}
function speak(text,opts){if(!state.sound)return;speakAttempt(text,opts||{},0)}
function speakAttempt(text,o,attempt){
if(!synth){playDing();return}
try{
if(synth.speaking||synth.pending)synth.cancel();
if(synth.paused)synth.resume();
const u=new SpeechSynthesisUtterance(text);
u.lang='pt-BR';u.rate=o.rate||0.88;u.pitch=1.03;u.volume=1;
if(ptVoice)u.voice=ptVoice;
currentUtterance=u;
let started=false;
u.onstart=()=>{started=true;if(speakWatchdog){window.clearTimeout(speakWatchdog);speakWatchdog=null}};
u.onend=()=>{if(currentUtterance===u)currentUtterance=null};
u.onerror=u.onend;
if(speakWatchdog)window.clearTimeout(speakWatchdog);
window.setTimeout(()=>{try{synth.speak(u)}catch(e){}},0);
speakWatchdog=window.setTimeout(()=>{
speakWatchdog=null;if(started)return;
try{synth.cancel();synth.resume()}catch(e){}
if(attempt===0)speakAttempt(text,o,1);else playDing();
},1200);
}catch(e){playDing()}
}

function showToast(m){if(toastTimer)window.clearTimeout(toastTimer);els.toast.textContent=m;els.toast.classList.add('show');toastTimer=window.setTimeout(()=>els.toast.classList.remove('show'),1850)}

function launchConfetti(amount,burst){
if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
const palette=['#f6bd4b','#ed5d72','#7b3fb3','#30aa8c','#4c8ce8','#ff8a4c'];
for(let i=0;i<amount;i++){
const piece=document.createElement('div');piece.className='confetti'+(burst?' burst':'');
piece.style.background=randomFrom(palette);
const shape=Math.random();
if(shape<.33)piece.style.borderRadius='50%';else if(shape<.55){piece.style.width='5px';piece.style.height='18px';piece.style.borderRadius='999px'}
if(!piece.style.width){piece.style.width=(7+Math.random()*7)+'px';piece.style.height=(10+Math.random()*12)+'px'}
piece.style.setProperty('--fall',(2.1+Math.random()*2.1)+'s');
piece.style.setProperty('--spin',(360+Math.random()*1080)+'deg');
if(burst){
piece.style.setProperty('--bx',(-42+Math.random()*84)+'vw');
piece.style.setProperty('--by',(-34+Math.random()*22)+'vh');
piece.style.animationDelay=(Math.random()*.25)+'s';
}else{
piece.style.left=Math.random()*100+'vw';
piece.style.setProperty('--drift',(-120+Math.random()*240)+'px');
piece.style.animationDelay=(Math.random()*.65)+'s';
}
document.body.appendChild(piece);window.setTimeout(()=>piece.remove(),5200);
}
}

function ballColor(n){if(n<=9)return'#e55373';if(n<=19)return'#e77b39';if(n<=29)return'#c68c12';if(n<=39)return'#319c63';if(n<=49)return'#238f91';if(n<=59)return'#347dbf';if(n<=69)return'#5563c1';if(n<=79)return'#7b3fb3';return'#b6428b'}

function encouragementMessage(){return randomFrom(['Esse passou voando. O próximo pode ser seu!','A cartela está esquentando.','Olho vivo, Ivany. A sorte está passeando.','Seguimos firmes. Tem número bom vindo aí.','Nada por aqui desta vez. Vamos ao próximo!'])}

// Narração estilo bingo real: "cinco... dois... cinquenta e dois!" (só nas velocidades 5s/7s)
function numberAnnouncement(n){
if(state.drawInterval<=3000||n<10)return 'Número '+n;
return Math.floor(n/10)+', '+(n%10)+'... '+n+'!';
}

function getVictories(){try{return parseInt(localStorage.getItem('bingo-ivany-victories')||'0',10)||0}catch(e){return 0}}
function addVictory(){try{localStorage.setItem('bingo-ivany-victories',String(getVictories()+1))}catch(e){}}

function withViewTransition(fn){if(document.startViewTransition){document.startViewTransition(fn)}else{fn()}}

let heroVisible=true;
function updateStickyBar(){
const last=state.drawn[state.drawn.length-1];
const show=!heroVisible&&state.started&&Number.isInteger(last);
els.stickyBar.hidden=!show;
if(!show)return;
els.stickyBall.textContent=String(last);els.stickyBall.style.color=ballColor(last);
const drawnSet=new Set(state.drawn);
let pending=0;
state.ivanyCartelas.forEach((ct,i)=>{const marked=state.markedByCartela[i]||[];pending+=ct.ticket.flat().filter(n=>Number.isInteger(n)&&drawnSet.has(n)&&!marked.includes(n)).length});
els.stickyPending.hidden=pending===0;
if(pending>0)els.stickyPending.textContent=pending+' p/ marcar';
}

function confirmNewGame(){const hasProgress=state.drawn.length>0;if(hasProgress&&!window.confirm('Começar um novo jogo? A partida atual será apagada.'))return;els.escolhaOverlay.classList.remove('hidden')}

window.BingoIvanyStart=(mode)=>{startNewGame(mode)};

els.welcomePlayBtn.addEventListener('click',()=>{els.welcomeOverlay.classList.add('hidden');els.escolhaOverlay.classList.remove('hidden')});
els.escolhaAutoBtn.addEventListener('click',()=>startNewGame('auto'));
els.escolhaManualBtn.addEventListener('click',()=>startNewGame('manual'));
els.resumeBtn.addEventListener('click',resumeGame);
els.voiceTestBtn.addEventListener('click',()=>{unlockAudio();const wasMuted=!state.sound;if(wasMuted){state.sound=true;renderSound();saveState()}speak('Olá, Ivany! A minha voz está funcionando. Vamos jogar bingo!');els.voiceHint.hidden=false});
els.mainBtn.addEventListener('click',()=>{if(state.conquistasClaimed.full)startNewGame(state.mode||'auto');else toggleMainAction()});
els.newGameBtn.addEventListener('click',confirmNewGame);
els.soundBtn.addEventListener('click',toggleSound);
els.celebrationContinueBtn.addEventListener('click',closeCelebrationAndContinue);
els.playersHeader.addEventListener('click',()=>{state.playersOpen=!state.playersOpen;els.playersPanel.classList.toggle('collapsed',!state.playersOpen);saveState()});
els.repeatBtn.addEventListener('click',()=>{const last=state.drawn[state.drawn.length-1];if(Number.isInteger(last))speak('Número '+last)});
els.speedSlider.addEventListener('input',()=>{const s=parseInt(els.speedSlider.value,10);state.drawInterval=s*1000;renderSpeed()});
els.speedSlider.addEventListener('change',()=>{const s=parseInt(els.speedSlider.value,10);state.drawInterval=s*1000;renderSpeed();saveState();showToast(s===3?'Velocidade rápida ⚡':s===7?'Velocidade lenta 🐢':'Velocidade média');if(state.started&&state.mode==='auto'&&!state.paused&&!state.conquistasClaimed.full)scheduleAutoDraw()});

document.querySelectorAll('.escolha-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.escolha-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');escolhaCount=parseInt(btn.dataset.count)})});

els.stickyBar.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
if('IntersectionObserver' in window){
new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;updateStickyBar()},{threshold:0}).observe(document.getElementById('hero'));
}else{heroVisible=false}

const victories=getVictories();
if(victories>0){els.victoriesNote.hidden=false;els.victoriesNote.textContent='🏆 Você já fez '+victories+(victories>1?' bingos!':' bingo!')}

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){resetSpeech()}if(document.visibilityState==='visible'&&state.started){requestWakeLock();if(state.mode==='auto'&&!state.paused&&!state.conquistasClaimed.full){scheduleAutoDraw()}}else if(document.visibilityState==='hidden'&&state.mode==='auto'&&!state.paused){state.paused=true;clearTimers();saveState();renderControls()}});
window.addEventListener('beforeunload',saveState);

const saved=loadSavedState();
if(saved&&saved.started&&saved.drawn.length>0&&!saved.conquistasClaimed.full){els.resumeBtn.hidden=false;els.resumeBtn.textContent='Continuar ('+saved.drawn.length+' números sorteados)';els.welcomeOverlay.classList.remove('hidden')}else{els.welcomeOverlay.classList.remove('hidden')}
state=saved&&saved.started?{...saved,paused:true}:blankState();
if(saved&&!state.started){state.drawInterval=saved.drawInterval||DEFAULT_INTERVAL;state.sound=saved.sound!==false;state.playersOpen=!!saved.playersOpen}
escolhaCount=state.cartelasCount||1;
if(state.started)renderAll();else{renderTicket();renderControls();renderSound();renderSpeed()}

if('serviceWorker' in navigator&&/^https?:$/.test(window.location.protocol)){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
})();