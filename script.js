'use strict';
/* ---------- constants & state ---------- */
const CATS=['Food','Transport','Shopping','Entertainment','Education','Health','Bills','Subscriptions','Travel','Other'];
const PAY=['Cash','Card','UPI','Bank Transfer','Other'];
const MOODS=['Excellent','Good','Neutral','Bad','Terrible'];
const ACAT=['Sleep','Study','Work','Exercise','College','Personal','Entertainment','Social','Other'];
const CURS={INR:'₹',USD:'$',EUR:'€',GBP:'£'};
const PAGES=[['dashboard','Dashboard'],['money','Money'],['journal','Journal'],['routine','Routine'],['insights','Insights'],['review','Weekly Review'],['settings','Settings']];
const COLL=['transactions','journalEntries','activities','budgets'];
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const NE='Not enough data yet. Keep logging your days to unlock this insight.';
const S={transactions:[],journalEntries:[],activities:[],budgets:[],settings:{currency:'INR',theme:'light',defaultCategory:'Food'}};
let page='dashboard';

/* ---------- utils ---------- */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>{x=Number(x);return Number.isFinite(x)?x:0};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const iso=d=>{const z=new Date(d);return z.getFullYear()+'-'+String(z.getMonth()+1).padStart(2,'0')+'-'+String(z.getDate()).padStart(2,'0')};
const today=()=>iso(new Date());
const addDays=(s,k)=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+k);return iso(d)};
const wday=s=>new Date(s+'T00:00:00').getDay();
const isD=s=>/^\d{4}-\d\d-\d\d$/.test(s||'');
const cur=x=>(CURS[S.settings.currency]||'₹')+n(x).toLocaleString('en-IN',{maximumFractionDigits:2});
const tmin=t=>{const m=/^(\d\d):(\d\d)$/.exec(t||'');return m?+m[1]*60+ +m[2]:null};
const hm=m=>{m=Math.round(n(m));return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'};
const clock=m=>{m=((Math.round(m)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const rng=a=>a.length?Math.max(...a)-Math.min(...a):0;
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const sum=l=>l.reduce((s,t)=>s+n(t.amount),0);
const exps=l=>l.filter(t=>t.type==='Expense');
const inRange=(d,r)=>d>=r[0]&&d<=r[1];
const recent=(l,k)=>l.filter(x=>x.date>=addDays(today(),-(k-1)));
const dur=a=>{const s=tmin(a.start),e=tmin(a.end);if(s===null||e===null)return 0;return e>s?e-s:(e<s&&a.category==='Sleep'?e+1440-s:0)};
const stat=(l,v)=>`<div class="stat"><div class="sv">${v}</div><div class="sl">${l}</div></div>`;
const empty=(a,b)=>`<div class="empty"><b>${a}</b>${b||''}</div>`;
const av=(a,f)=>a.length?f(avg(a)):'—';
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),2800)}

/* ---------- normalisers (used for load + import) ---------- */
const NORM={
 transactions:r=>r&&n(r.amount)>0&&isD(r.date)?{id:String(r.id||uid()),type:r.type==='Income'?'Income':'Expense',amount:n(r.amount),category:CATS.includes(r.category)?r.category:'Other',date:r.date,description:String(r.description||''),payment:PAY.includes(r.payment)?r.payment:'Other',notes:String(r.notes||'')}:null,
 journalEntries:r=>r&&r.title&&isD(r.date)?{id:String(r.id||uid()),date:r.date,title:String(r.title),text:String(r.text||''),mood:MOODS.includes(r.mood)?r.mood:'Neutral',productivity:clamp(Math.round(n(r.productivity))||5,1,10),energy:clamp(Math.round(n(r.energy))||5,1,10),tags:Array.isArray(r.tags)?r.tags.map(String):[]}:null,
 activities:r=>r&&r.name&&isD(r.date)&&tmin(r.start)!==null&&tmin(r.end)!==null?{id:String(r.id||uid()),name:String(r.name),category:ACAT.includes(r.category)?r.category:'Other',date:r.date,start:r.start,end:r.end,notes:String(r.notes||'')}:null,
 budgets:r=>r&&CATS.includes(r.category)&&n(r.limit)>0?{id:String(r.id||uid()),category:r.category,limit:n(r.limit)}:null
};
function load(){
 COLL.forEach(k=>{try{const v=JSON.parse(localStorage.getItem('lf_'+k));S[k]=Array.isArray(v)?v.map(NORM[k]).filter(Boolean):[]}catch(e){S[k]=[]}});
 try{applySettings(JSON.parse(localStorage.getItem('lf_settings')))}catch(e){}
}
function applySettings(d){
 if(!d||typeof d!=='object')return;
 if(CURS[d.currency])S.settings.currency=d.currency;
 if(d.theme==='dark'||d.theme==='light')S.settings.theme=d.theme;
 if(CATS.includes(d.defaultCategory))S.settings.defaultCategory=d.defaultCategory;
}
function save(){
 try{COLL.forEach(k=>localStorage.setItem('lf_'+k,JSON.stringify(S[k])));localStorage.setItem('lf_settings',JSON.stringify(S.settings))}
 catch(e){toast('Could not save: browser storage is unavailable or full')}
}

/* ---------- modal + generic form ---------- */
const showModal=h=>{const m=$('#modal');m.innerHTML=h;m.classList.add('show')};
const closeModal=()=>{const m=$('#modal');m.classList.remove('show');m.innerHTML=''};
function openForm(title,fields,v,onSave,validate){
 showModal(`<form class="box" novalidate><h3>${esc(title)}</h3>${fields.map(f=>`<label>${esc(f.label)}${
  f.type==='textarea'?`<textarea name="${f.k}" rows="3">${esc(v[f.k])}</textarea>`
  :f.type==='select'?`<select name="${f.k}">${f.opts.map(o=>`<option ${o==v[f.k]?'selected':''}>${esc(o)}</option>`).join('')}</select>`
  :`<input name="${f.k}" type="${f.type}" value="${esc(v[f.k])}" ${f.step?`step="${f.step}"`:''}>`}</label>`).join('')}
  <div class="err"></div><div class="row"><button type="button" class="btn ghost" id="fc">Cancel</button><button class="btn">Save</button></div></form>`);
 const form=$('#modal form');
 $('#fc').onclick=closeModal;
 form.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form).entries());const er=validate(d);
  if(er){form.querySelector('.err').textContent=er;return}
  onSave(d);closeModal()};
}
function upsert(key,rec){const i=S[key].findIndex(r=>r.id===rec.id);if(i<0)S[key].push(rec);else S[key][i]=rec;save();renderAll()}
function remove(key,id,label,msg){if(!confirm('Delete this '+label+'? This cannot be undone.'))return;S[key]=S[key].filter(r=>r.id!==id);save();renderAll();toast(msg)}

/* ---------- forms ---------- */
function txForm(r){
 const v=r||{type:'Expense',category:S.settings.defaultCategory,date:today(),payment:'UPI'};
 openForm(r?'Edit transaction':'Add transaction',[
  {k:'type',label:'Type',type:'select',opts:['Expense','Income']},{k:'amount',label:'Amount',type:'number',step:'0.01'},
  {k:'category',label:'Category',type:'select',opts:CATS},{k:'date',label:'Date',type:'date'},
  {k:'description',label:'Description',type:'text'},{k:'payment',label:'Payment method',type:'select',opts:PAY},{k:'notes',label:'Notes',type:'textarea'}],v,
 d=>{upsert('transactions',{id:r?r.id:uid(),type:d.type,amount:+d.amount,category:d.category,date:d.date,description:d.description.trim(),payment:d.payment,notes:d.notes.trim()});toast(r?'Expense updated':'Expense added')},
 d=>!(+d.amount>0)?'Amount must be greater than 0.':!isD(d.date)?'Date is required.':'');
}
function budForm(r){
 openForm(r?'Edit budget':'Set monthly budget',[{k:'category',label:'Category',type:'select',opts:CATS},{k:'limit',label:'Monthly limit',type:'number',step:'0.01'}],r||{category:'Food'},
 d=>{const ex=S.budgets.find(b=>b.category===d.category);S.budgets=S.budgets.filter(b=>(!r||b.id!==r.id)&&(!ex||b.id!==ex.id));S.budgets.push({id:ex?ex.id:r?r.id:uid(),category:d.category,limit:+d.limit});save();renderAll();toast('Budget updated')},
 d=>!(+d.limit>0)?'Budget must be greater than 0 (it cannot be negative).':'');
}
function jForm(r){
 const v=r?{...r,tags:r.tags.join(', ')}:{date:today(),mood:'Neutral',productivity:5,energy:5,tags:''};
 openForm(r?'Edit journal entry':'New journal entry',[
  {k:'date',label:'Date',type:'date'},{k:'title',label:'Title',type:'text'},{k:'text',label:'Journal text',type:'textarea'},
  {k:'mood',label:'Mood',type:'select',opts:MOODS},{k:'productivity',label:'Productivity (1–10)',type:'number'},{k:'energy',label:'Energy (1–10)',type:'number'},{k:'tags',label:'Tags (comma separated)',type:'text'}],v,
 d=>{upsert('journalEntries',{id:r?r.id:uid(),date:d.date,title:d.title.trim(),text:d.text.trim(),mood:d.mood,productivity:+d.productivity,energy:+d.energy,tags:d.tags.split(',').map(t=>t.trim()).filter(Boolean)});toast(r?'Journal entry updated':'Journal entry added')},
 d=>{const ok=x=>Number.isInteger(+x)&&x!==''&&+x>=1&&+x<=10;
  return !isD(d.date)?'Date is required.':!d.title.trim()?'Title cannot be empty.':!ok(d.productivity)?'Productivity must be a whole number from 1 to 10.':!ok(d.energy)?'Energy must be a whole number from 1 to 10.':''});
}
function aForm(r){
 openForm(r?'Edit activity':'Log activity',[
  {k:'name',label:'Activity name',type:'text'},{k:'category',label:'Category',type:'select',opts:ACAT},{k:'date',label:'Date',type:'date'},
  {k:'start',label:'Start time',type:'time'},{k:'end',label:'End time',type:'time'},{k:'notes',label:'Notes',type:'textarea'}],r||{category:'Study',date:$('#r-tdate').value||today()},
 d=>{upsert('activities',{id:r?r.id:uid(),name:d.name.trim(),category:d.category,date:d.date,start:d.start,end:d.end,notes:d.notes.trim()});toast(r?'Activity updated':'Activity added')},
 d=>{const s=tmin(d.start),e=tmin(d.end);
  if(!d.name.trim())return'Activity name cannot be empty.';if(!isD(d.date))return'Date is required.';
  if(s===null||e===null)return'Start and end times are required.';
  if(e===s)return'End time must be after the start time.';
  if(e<s&&d.category!=='Sleep')return'End time cannot be before the start time (only Sleep may run past midnight).';
  if(d.category==='Sleep'){const m=dur(d);if(m<30||m>960)return'Sleep duration should be between 30 minutes and 16 hours.'}
  return''});
}
function viewJ(id){
 const j=S.journalEntries.find(x=>x.id===id);if(!j)return;
 showModal(`<div class="box"><h3>${esc(j.title)}</h3><div class="mut sm">${j.date} · Mood: ${j.mood} · Productivity ${j.productivity}/10 · Energy ${j.energy}/10</div><div class="pre">${esc(j.text)||'<span class="mut">No text.</span>'}</div><div>${j.tags.map(t=>`<span class="tag">#${esc(t)}</span>`).join(' ')}</div><div class="row"><button class="btn ghost" id="vc">Close</button><button class="btn" id="ve">Edit</button></div></div>`);
 $('#vc').onclick=closeModal;$('#ve').onclick=()=>{closeModal();jForm(j)};
}
const byId=(k,id)=>S[k].find(x=>x.id===id);
const ACT={
 'edit-tx':id=>txForm(byId('transactions',id)),'del-tx':id=>remove('transactions',id,'transaction','Expense deleted'),
 'edit-j':id=>jForm(byId('journalEntries',id)),'del-j':id=>remove('journalEntries',id,'journal entry','Journal entry deleted'),'view-j':viewJ,
 'edit-a':id=>aForm(byId('activities',id)),'del-a':id=>remove('activities',id,'activity','Activity deleted'),
 'edit-b':id=>budForm(byId('budgets',id)),'del-b':id=>remove('budgets',id,'budget','Budget deleted')
};
const btns=(e,d,id,extra='')=>`<div class="acts">${extra}<button class="ic" title="Edit" data-a="edit-${e}" data-id="${id}">✏️</button><button class="ic" title="Delete" data-a="del-${e}" data-id="${id}">🗑️</button></div>`;

/* ---------- analysis engine ---------- */
function rangeOf(r){
 const t=today(),d=new Date();
 if(r==='today')return[t,t];
 if(r==='week')return[addDays(t,-((d.getDay()+6)%7)),t];
 if(r==='month')return[iso(new Date(d.getFullYear(),d.getMonth(),1)),iso(new Date(d.getFullYear(),d.getMonth()+1,0))];
 if(r==='last')return[iso(new Date(d.getFullYear(),d.getMonth()-1,1)),iso(new Date(d.getFullYear(),d.getMonth(),0))];
 return['0000-00-00','9999-99-99'];
}
function byCat(l){const m={};exps(l).forEach(t=>m[t.category]=(m[t.category]||0)+t.amount);return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function sleepDays(k){
 const m={};
 recent(S.activities,k).filter(a=>a.category==='Sleep').forEach(a=>{
  const o=m[a.date]||(m[a.date]={date:a.date,min:0,bed:null});o.min+=dur(a);
  if(o.bed===null){const s=tmin(a.start);o.bed=s<720?s+1440:s}});
 return Object.values(m).filter(o=>o.min>0);
}
function gaps(k){
 const d={};let days=0,total=0;
 recent(S.activities,k).filter(a=>a.category!=='Sleep').forEach(a=>(d[a.date]=d[a.date]||[]).push(a));
 Object.values(d).forEach(l=>{
  if(l.length<2)return;total++;
  l.sort((a,b)=>tmin(a.start)-tmin(b.start));
  let end=tmin(l[0].end),big=false;
  l.slice(1).forEach(a=>{if(tmin(a.start)-end>=180&&tmin(a.start)<=1320)big=true;end=Math.max(end,tmin(a.end))});
  if(big)days++;
 });
 return{days,total};
}
function exerciseCount(k){return recent(S.activities,k).filter(a=>a.category==='Exercise').length}
function peak(){
 const js=recent(S.journalEntries,30);if(js.length<3)return null;
 const a=avg(js.map(j=>j.productivity)),good=new Set(js.filter(j=>j.productivity>=a&&j.productivity>=6).map(j=>j.date));
 const st=recent(S.activities,30).filter(x=>good.has(x.date)&&(x.category==='Study'||x.category==='Work')).map(x=>tmin(x.start));
 return st.length>=2?median(st):null;
}
function findings(){
 const o=[],sd=sleepDays(14),js=recent(S.journalEntries,14),T=recent(S.transactions,30);
 if(sd.length>=3){
  const a=avg(sd.map(x=>x.min));
  if(a<360)o.push(['Sleep','Your average sleep duration is below 6 hours.']);
  if(rng(sd.map(x=>x.min))>120)o.push(['Sleep','Your sleep schedule appears inconsistent.']);
  if(rng(sd.map(x=>x.bed))>120)o.push(['Sleep','Your sleep timing appears inconsistent.']);
  if(!o.length)o.push(['Sleep',`Your sleep looks fairly steady, averaging ${hm(a)}.`]);
 }
 if(js.length>=3){
  const last=js.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  if(avg(last.map(j=>j.productivity))<5)o.push(['Productivity','Your recent productivity ratings have been relatively low.']);
  const all=avg(js.map(j=>j.productivity)),m={};
  js.forEach(j=>(m[wday(j.date)]=m[wday(j.date)]||[]).push(j.productivity));
  const hi=Object.entries(m).filter(([d,v])=>v.length>=2&&avg(v)>=all+1).map(([d])=>DAYS[d]);
  if(hi.length)o.push(['Productivity','You appear to be more productive on these days: '+hi.join(', ')+'.']);
 }
 const ex=exps(T);
 if(ex.length>=3){
  const c=byCat(T),tot=sum(ex);
  if(c[0][1]/tot>0.4)o.push(['Spending',`Most of your spending is concentrated in ${c[0][0]} (${Math.round(c[0][1]/tot*100)}%).`]);
  const t=today(),w1=sum(exps(S.transactions.filter(x=>inRange(x.date,[addDays(t,-6),t])))),w0=sum(exps(S.transactions.filter(x=>inRange(x.date,[addDays(t,-13),addDays(t,-7)]))));
  if(w0>0&&w1>w0*1.25)o.push(['Spending','Your spending has increased recently compared with your previous week.']);
 }
 const g=gaps(14);
 if(g.total>=2&&g.days>=Math.ceil(g.total/2))o.push(['Routine','Your schedule contains several large unstructured periods.']);
 if(new Set(recent(S.activities,14).map(a=>a.date)).size>=3&&exerciseCount(7)<3)o.push(['Exercise','Your recent exercise frequency is relatively low.']);
 return o;
}
function recs(){
 const r=[],sd=sleepDays(14),mo=rangeOf('month');
 if(sd.length>=3){
  const a=avg(sd.map(x=>x.min));
  if(a<360)r.push({t:'Prioritize a consistent sleep window.',w:`Your average sleep over ${sd.length} logged nights is ${hm(a)}, which is under 6 hours.`});
  if(rng(sd.map(x=>x.bed))>120)r.push({t:`Consider a regular bedtime around ${clock(median(sd.map(x=>x.bed)))}.`,w:`Your bedtime varies by ${hm(rng(sd.map(x=>x.bed)))} across logged nights.`});
 }
 if(new Set(recent(S.activities,14).map(a=>a.date)).size>=3&&exerciseCount(7)<3)r.push({t:'Consider scheduling 30–60 minutes of exercise at least 3 times per week.',w:`You logged ${exerciseCount(7)} exercise session(s) in the last 7 days.`});
 const p=peak();
 if(p!==null)r.push({t:`Plan your most important tasks around ${clock(p-60)}–${clock(p+60)}.`,w:`On days with higher productivity ratings, your focused work usually starts around ${clock(p)}.`});
 S.budgets.forEach(b=>{const u=sum(exps(S.transactions).filter(t=>t.category===b.category&&inRange(t.date,mo)));
  if(u>=b.limit)r.push({t:`Consider reducing discretionary spending in ${b.category} for the rest of the month.`,w:`You have used ${cur(u)} of your ${cur(b.limit)} ${b.category} budget this month.`})});
 const jc=recent(S.journalEntries,7).length;
 if((S.journalEntries.length||S.activities.length>=3)&&jc<4)r.push({t:'Try a short daily journaling block (5–10 minutes), perhaps before bed.',w:`You wrote ${jc} journal entr${jc===1?'y':'ies'} in the last 7 days.`});
 const g=gaps(14);
 if(g.total>=2&&g.days>=Math.ceil(g.total/2))r.push({t:'Consider filling long open stretches with Study, Exercise, Personal tasks, or Rest.',w:`${g.days} of ${g.total} recent days include a stretch of 3+ hours with no planned activity.`});
 return r;
}
function suggest(){
 const A=recent(S.activities,30);if(A.length<3)return null;
 const md=c=>median(A.filter(a=>c.includes(a.category)).map(a=>tmin(a.start)));
 const sl=A.filter(a=>a.category==='Sleep'),beds=sl.map(a=>{const s=tmin(a.start);return s<720?s+1440:s}),wakes=sl.map(a=>tmin(a.end));
 const r15=m=>Math.round(m/15)*15;
 const bed=beds.length?r15(median(beds)):1380,wake=wakes.length?r15(median(wakes)):420;
 const pk=peak(),sm=md(['Study']),ex=md(['Exercise']),cw=md(['College','Work']);
 const st=pk!==null?r15(pk):sm!==null?r15(sm):1110;
 const din=Math.min(1320,Math.max(1230,st+120));
 return [[wake,'Wake up',wakes.length>0],[wake+30,'Breakfast',false],[cw!==null?r15(cw):540,'College / Work',cw!==null],
  [ex!==null?r15(ex):1050,'Exercise',ex!==null],[st,pk!==null?'Deep work / Study (your most productive window)':'Study / Deep work',pk!==null||sm!==null],
  [din,'Dinner',false],[bed-60,'Journal / Wind down',false],[bed,'Sleep (consistent bedtime)',beds.length>0]]
  .sort((a,b)=>a[0]-b[0]).map(([m,l,h])=>({t:clock(m),l,h}));
}
function insights(){
 const T=S.transactions,mo=rangeOf('month'),lm=rangeOf('last'),o=[];
 const cm=byCat(T.filter(t=>inRange(t.date,mo))),pm=Object.fromEntries(byCat(T.filter(t=>inRange(t.date,lm))));
 let sp=null;
 if(cm.length){const[c,v]=cm[0],p=pm[c];sp=p>0?`You spent ${Math.abs(Math.round((v-p)/p*100))}% ${v>=p?'more':'less'} on ${c.toLowerCase()} this month than last month.`:`${c} is your highest spending category this month.`}
 o.push({i:'💰',h:'Spending Insight',t:sp});
 const sd=sleepDays(14);
 o.push({i:'😴',h:'Sleep Insight',t:sd.length>=2?`Your average sleep is ${hm(avg(sd.map(x=>x.min)))} across ${sd.length} logged nights.`:null});
 const js=recent(S.journalEntries,30);let pt=null;
 if(js.length>=3){
  const wd=js.filter(j=>wday(j.date)>0&&wday(j.date)<6).map(j=>j.productivity),we=js.filter(j=>wday(j.date)%6===0).map(j=>j.productivity);
  if(wd.length&&we.length)pt=Math.abs(avg(wd)-avg(we))<0.5?'Your productivity looks similar on weekdays and weekends.':`Your productivity is highest on ${avg(wd)>avg(we)?'weekdays':'weekends'}.`;
  else{const m={};js.forEach(j=>(m[wday(j.date)]=m[wday(j.date)]||[]).push(j.productivity));const b=Object.entries(m).sort((a,c)=>avg(c[1])-avg(a[1]))[0];pt=`Your productivity ratings are highest on ${DAYS[b[0]]}s.`}
 }
 o.push({i:'📚',h:'Productivity Insight',t:pt});
 const ec=exerciseCount(7);
 o.push({i:'🏋️',h:'Activity Insight',t:recent(S.activities,7).length?`You exercised ${ec} time${ec===1?'':'s'} this week.`:null});
 const A=recent(S.activities,14).filter(a=>a.category!=='Sleep'&&tmin(a.start)!==null);let rt=null;
 if(A.length>=4){
  const cov=(lo,hi)=>A.reduce((s,a)=>s+Math.max(0,Math.min(tmin(a.end),hi)-Math.max(tmin(a.start),lo)),0),m=cov(300,720),e=cov(1020,1380);
  rt=Math.abs(m-e)<60?'Your mornings and evenings look similarly structured.':`Your ${e>m?'evenings':'mornings'} appear more structured than your ${e>m?'mornings':'evenings'}.`;
 }
 o.push({i:'🧠',h:'Routine Insight',t:rt});
 return o;
}

/* ---------- renderers ---------- */
const txRow=(t,a)=>`<div class="item"><div class="grow"><b>${esc(t.description||t.category)}</b><div class="mut sm">${t.date} · ${esc(t.category)} · ${t.type} · ${esc(t.payment)}</div>${t.notes?`<div class="mut sm">${esc(t.notes)}</div>`:''}</div><div class="amt ${t.type==='Income'?'inc':'exp'}">${t.type==='Income'?'+':'−'}${cur(t.amount)}</div>${a?btns('tx','',t.id):''}</div>`;
const jRow=(j,a)=>`<div class="item"><div class="grow"><b>${esc(j.title)}</b><div class="mut sm">${j.date} · ${j.mood} · Productivity ${j.productivity}/10 · Energy ${j.energy}/10</div>${a?`<div class="sm">${esc(j.text.slice(0,140))}${j.text.length>140?'…':''}</div>`:''}<div>${j.tags.map(t=>`<span class="tag">#${esc(t)}</span>`).join(' ')}</div></div>${a?btns('j','',j.id,`<button class="ic" title="View" data-a="view-j" data-id="${j.id}">👁️</button>`):''}</div>`;
const aRow=a=>`<div class="item"><div class="grow"><b>${esc(a.name)}</b><div class="mut sm">${a.date} · ${a.category} · ${a.start}–${a.end} · ${hm(dur(a))}</div>${a.notes?`<div class="mut sm">${esc(a.notes)}</div>`:''}</div>${btns('a','',a.id)}</div>`;
const tlHtml=l=>l.length?l.slice().sort((a,b)=>tmin(a.start)-tmin(b.start)).map(a=>`<div class="tl"><b>${a.start}</b><div>${esc(a.name)} <span class="mut sm">${a.category} · ${hm(dur(a))}</span></div></div>`).join(''):'';
const sugHtml=s=>s.map(x=>`<div class="tl"><b>${x.t}</b><div>${x.l} ${x.h?'<span class="tag">from your history</span>':'<span class="mut sm">starter default</span>'}</div></div>`).join('');

function rDash(){
 const h=new Date().getHours(),t=today();
 $('#greet').textContent=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
 const T=S.transactions.filter(x=>x.date===t),ex=sum(exps(T)),inc=sum(T.filter(x=>x.type==='Income')),sd=sleepDays(1),jt=S.journalEntries.find(j=>j.date===t);
 $('#d-today').innerHTML=stat('Spending',cur(ex))+stat('Income',cur(inc))+stat('Balance',cur(inc-ex))+stat('Sleep',sd[0]?hm(sd[0].min):'—')+stat('Productivity',jt?jt.productivity+'/10':'—')+stat('Mood',jt?jt.mood:'—')+stat('Journal',jt?'Written ✓':'Not yet');
 const mo=rangeOf('month'),M=S.transactions.filter(x=>inRange(x.date,mo)),me=sum(exps(M)),mi=sum(M.filter(x=>x.type==='Income')),J=S.journalEntries.filter(j=>inRange(j.date,mo)),msd=sleepDays(new Date().getDate());
 $('#d-month').innerHTML=stat('Income',cur(mi))+stat('Expenses',cur(me))+stat('Savings',cur(mi-me))+stat('Avg daily spending',cur(me/new Date().getDate()))+stat('Journal entries',J.length)+stat('Avg productivity',av(J.map(j=>j.productivity),x=>x.toFixed(1)+'/10'))+stat('Avg sleep',av(msd.map(x=>x.min),hm));
 const rt=S.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 $('#d-tx').innerHTML=rt.length?rt.map(x=>txRow(x,false)).join(''):empty('No expenses recorded yet.','Start tracking your spending to see your financial patterns.');
 const rj=S.journalEntries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
 $('#d-j').innerHTML=rj.length?rj.map(x=>jRow(x,false)).join(''):empty('No journal entries yet.','Write a few lines about your day.');
 const ta=S.activities.filter(a=>a.date===t);
 $('#d-rt').innerHTML=ta.length?tlHtml(ta):empty('Nothing logged for today.','Log an activity in Routine.');
 const ins=insights().filter(x=>x.t);
 $('#d-in').innerHTML=ins.length?ins.slice(0,3).map(x=>`<div class="find">${x.i} ${esc(x.t)}</div>`).join(''):empty(NE);
 const sg=suggest();
 $('#d-sg').innerHTML=sg?sugHtml(sg):empty('Log a few days of activity to generate routine insights.');
}

function ctx(id,h){
 const box=$('#'+id);box.innerHTML='<canvas></canvas>';
 const c=box.firstChild,w=box.clientWidth||300,r=window.devicePixelRatio||1;
 c.width=w*r;c.height=h*r;c.style.height=h+'px';
 const x=c.getContext('2d');x.scale(r,r);x.font='12px system-ui,sans-serif';
 const cs=getComputedStyle(document.body),g=k=>cs.getPropertyValue(k).trim();
 return{x,w,h,mut:g('--mut'),ac:g('--ac'),ok:g('--ok'),bad:g('--bad'),tx:g('--tx')};
}
function rMoney(){
 const rg=rangeOf($('#m-range').value),L=S.transactions.filter(t=>inRange(t.date,rg));
 const inc=sum(L.filter(t=>t.type==='Income')),ex=sum(exps(L)),cats=byCat(L);
 let a=rg[0]==='0000-00-00'?(L.length?L.map(x=>x.date).sort()[0]:today()):rg[0],b=rg[1]>today()?today():rg[1];
 if(b<a)b=a;
 const days=Math.max(1,Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5)+1);
 const top=L.length?L.reduce((m,t)=>t.amount>m.amount?t:m):null;
 $('#m-stats').innerHTML=stat('Income',cur(inc))+stat('Expenses',cur(ex))+stat('Savings',cur(inc-ex))+stat('Avg daily spending',cur(ex/days))+stat('Top category',cats[0]?esc(cats[0][0]):'—')+stat('Largest transaction',top?cur(top.amount):'—')+stat('Transactions',L.length);
 const noEx=empty('No expenses recorded yet.','Start tracking your spending to see your financial patterns.');
 if(!cats.length){$('#ch1').innerHTML=noEx;$('#ch3').innerHTML=noEx}
 else{
  const rows=cats.slice(0,8),g=ctx('ch1',rows.length*26+8),mx=rows[0][1];
  rows.forEach(([k,v],i)=>{const y=i*26+4,bw=Math.max(2,(g.w-190)*v/mx);g.x.fillStyle=g.mut;g.x.fillText(k,0,y+14);g.x.fillStyle=g.ac;g.x.fillRect(95,y,bw,18);g.x.fillStyle=g.tx;g.x.fillText(cur(v),100+bw,y+14)});
  const dm={};exps(L).forEach(t=>dm[t.date]=(dm[t.date]||0)+t.amount);
  const ds=Object.keys(dm).sort().slice(-60),g3=ctx('ch3',200),m3=Math.max(...ds.map(d=>dm[d])),X=i=>30+(ds.length>1?i*(g3.w-60)/(ds.length-1):(g3.w-60)/2),Y=v=>160-140*v/m3;
  g3.x.strokeStyle=g3.ac;g3.x.lineWidth=2;g3.x.beginPath();ds.forEach((d,i)=>i?g3.x.lineTo(X(i),Y(dm[d])):g3.x.moveTo(X(i),Y(dm[d])));g3.x.stroke();
  g3.x.fillStyle=g3.ac;ds.forEach((d,i)=>{g3.x.beginPath();g3.x.arc(X(i),Y(dm[d]),3,0,7);g3.x.fill()});
  g3.x.fillStyle=g3.mut;g3.x.fillText(ds[0],10,190);g3.x.textAlign='right';g3.x.fillText(ds[ds.length-1],g3.w-10,190);g3.x.fillText('peak '+cur(m3),g3.w-10,14);
 }
 if(!inc&&!ex)$('#ch2').innerHTML=empty('No transactions in this period.','Add income or expenses to compare them.');
 else{
  const g=ctx('ch2',200),mx=Math.max(inc,ex),bh=v=>130*v/mx;
  [[inc,'Income',g.ok],[ex,'Expenses',g.bad]].forEach(([v,l,c],i)=>{const x0=g.w/2-110+i*130;g.x.fillStyle=c;g.x.fillRect(x0,170-bh(v),90,bh(v));g.x.fillStyle=g.tx;g.x.textAlign='center';g.x.fillText(cur(v),x0+45,162-bh(v));g.x.fillStyle=g.mut;g.x.fillText(l,x0+45,190)});
 }
 const mo=rangeOf('month');
 $('#m-bud').innerHTML=S.budgets.length?S.budgets.map(bd=>{
  const u=sum(exps(S.transactions).filter(t=>t.category===bd.category&&inRange(t.date,mo))),p=bd.limit>0?u/bd.limit*100:0,c=p>=100?'bad':p>=80?'warn':'ok';
  return `<div class="bud"><div class="bar"><b>${esc(bd.category)}</b>${btns('b','',bd.id)}</div><div class="pg"><i class="${c}" style="width:${Math.min(100,p)}%"></i></div><div class="sm mut">Used ${cur(u)} · Remaining ${cur(Math.max(0,bd.limit-u))} · ${Math.round(p)}% of ${cur(bd.limit)}</div>${p>=100?'<div class="sm bad-t">Budget exceeded for this month.</div>':p>=80?'<div class="sm warn-t">Heads up: you have used 80% or more of this budget.</div>':''}</div>`}).join('')
  :empty('No budgets yet.','Set a monthly limit for a category to track it here.');
 const q=$('#m-q').value.trim().toLowerCase(),ty=$('#m-type').value,ca=$('#m-cat').value,dt=$('#m-date').value,so=$('#m-sort').value;
 const F=S.transactions.filter(t=>(!q||(t.description+' '+t.category).toLowerCase().includes(q))&&(!ty||t.type===ty)&&(!ca||t.category===ca)&&(!dt||t.date===dt));
 F.sort(so==='old'?(x,y)=>x.date.localeCompare(y.date):so==='hi'?(x,y)=>y.amount-x.amount:so==='lo'?(x,y)=>x.amount-y.amount:(x,y)=>y.date.localeCompare(x.date));
 $('#m-list').innerHTML=!S.transactions.length?noEx:F.length?F.map(t=>txRow(t,true)).join(''):empty('No transactions match your filters.');
}
function rJournal(){
 const q=$('#j-q').value.trim().toLowerCase(),mo=$('#j-mood').value,pr=+$('#j-prod').value,dt=$('#j-date').value,so=$('#j-sort').value;
 const F=S.journalEntries.filter(j=>(!q||(j.title+' '+j.text+' '+j.tags.join(' ')).toLowerCase().includes(q))&&(!mo||j.mood===mo)&&j.productivity>=pr&&(!dt||j.date===dt));
 F.sort(so==='old'?(a,b)=>a.date.localeCompare(b.date):so==='hi'?(a,b)=>b.productivity-a.productivity:so==='lo'?(a,b)=>a.productivity-b.productivity:(a,b)=>b.date.localeCompare(a.date));
 $('#j-list').innerHTML=!S.journalEntries.length?empty('No journal entries yet.','Write a few lines about your day to start building your story.'):F.length?F.map(j=>jRow(j,true)).join(''):empty('No entries match your filters.');
}
function rRoutine(){
 const td=$('#r-tdate').value||today();
 const day=S.activities.filter(a=>a.date===td);
 $('#r-tl').innerHTML=day.length?tlHtml(day):empty('Nothing logged for this day.','Use "Log activity" to add what you did.');
 const ca=$('#r-cat').value,dt=$('#r-date').value,so=$('#r-sort').value;
 const F=S.activities.filter(a=>(!ca||a.category===ca)&&(!dt||a.date===dt));
 const k=a=>a.date+a.start;
 F.sort(so==='rev'?(a,b)=>k(b).localeCompare(k(a)):so==='long'?(a,b)=>dur(b)-dur(a):so==='short'?(a,b)=>dur(a)-dur(b):(a,b)=>k(a).localeCompare(k(b)));
 $('#r-list').innerHTML=!S.activities.length?empty('No activities yet.','Log how you spend your day to see your timeline.'):F.length?F.map(aRow).join(''):empty('No activities match your filters.');
 const msg=empty('Log a few days of activity to generate routine insights.'),enough=S.activities.length>=3;
 const f=findings(),r=recs(),sg=suggest();
 $('#r-an').innerHTML=!enough?msg:f.length?f.map(([c,t])=>`<div class="find"><span class="tag">${c}</span> ${esc(t)}</div>`).join(''):empty('No clear patterns yet.','Keep logging — patterns appear after a few days.');
 $('#r-rec').innerHTML=!enough?msg:r.length?r.map(x=>`<div class="find">${esc(x.t)}<div class="why">Why: ${esc(x.w)}</div></div>`).join(''):empty('No changes suggested right now.','Your logged routine looks well balanced.');
 $('#r-sg').innerHTML=sg?sugHtml(sg)+'<div class="why">Built from your logged sleep, study, exercise and work times where available.</div>':msg;
}
function rInsights(){
 $('#i-list').innerHTML=insights().map(x=>`<div class="card"><h3>${x.i} ${x.h}</h3><div>${x.t?esc(x.t):`<span class="mut">${NE}</span>`}</div></div>`).join('');
}
function rReview(){
 const t=today(),f=addDays(t,-6),w=d=>d>=f&&d<=t;
 const T=S.transactions.filter(x=>w(x.date)),J=S.journalEntries.filter(x=>w(x.date)),A=S.activities.filter(x=>w(x.date));
 if(!T.length&&!J.length&&!A.length){$('#w-body').innerHTML=empty('Nothing logged in the last 7 days.','Log your spending, journal or activities to unlock your weekly review.');return}
 const inc=sum(T.filter(x=>x.type==='Income')),ex=sum(exps(T)),sd=sleepDays(7),cats=byCat(T),ec=exerciseCount(7);
 const best=J.length?J.reduce((m,j)=>j.productivity>m.productivity?j:m):null;
 const prev=sum(exps(S.transactions.filter(x=>inRange(x.date,[addDays(t,-13),addDays(t,-7)]))));
 const good=[],imp=[];
 if(inc>ex&&T.length)good.push(`You kept spending below income, saving ${cur(inc-ex)}.`);
 if(sd.length>=3&&avg(sd.map(x=>x.min))>=420)good.push('Your sleep averaged 7 hours or more.');
 if(ec>=3)good.push(`You exercised ${ec} times.`);
 if(J.length>=4)good.push('You journaled on most days.');
 if(J.length>=3&&avg(J.map(j=>j.productivity))>=7)good.push('Your productivity ratings were strong.');
 if(sd.length>=3&&avg(sd.map(x=>x.min))<360)imp.push('Sleep averaged under 6 hours; a steadier sleep window may help.');
 if(A.length&&ec<3)imp.push(`Exercise happened ${ec} time(s); aiming for 3 sessions could help.`);
 if(J.length<3)imp.push('Journaling was occasional; a short daily entry may help you reflect.');
 if(ex>0&&cats[0][1]/ex>0.4)imp.push(`${cats[0][0]} made up ${Math.round(cats[0][1]/ex*100)}% of spending.`);
 if(prev>0&&ex>prev*1.25)imp.push('Spending was higher than in the previous week.');
 const foc=recs().slice(0,3).map(x=>x.t);
 const ul=(l,e)=>l.length?`<ul class="l">${l.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<span class="mut">${e}</span>`;
 $('#w-body').innerHTML=`<div class="stats">${stat('Spending',cur(ex))}${stat('Income',cur(inc))}${stat('Savings',cur(inc-ex))}${stat('Avg sleep',av(sd.map(x=>x.min),hm))}${stat('Avg productivity',av(J.map(j=>j.productivity),x=>x.toFixed(1)+'/10'))}${stat('Avg energy',av(J.map(j=>j.energy),x=>x.toFixed(1)+'/10'))}${stat('Exercise sessions',ec)}${stat('Journal entries',J.length)}${stat('Most productive day',best?DAYS[wday(best.date)]:'—')}${stat('Top spending category',cats[0]?esc(cats[0][0]):'—')}</div>
 <div class="card"><h3>What went well</h3>${ul(good,'Keep logging to see highlights.')}</div>
 <div class="card"><h3>What could improve</h3>${ul(imp,'Nothing stands out this week.')}</div>
 <div class="card"><h3>Suggested focus for next week</h3>${ul(foc,'Keep up your current rhythm and keep logging.')}</div>`;
}
function rSettings(){$('#s-cur').value=S.settings.currency;$('#s-theme').value=S.settings.theme;$('#s-cat').value=S.settings.defaultCategory}
function renderAll(){({dashboard:rDash,money:rMoney,journal:rJournal,routine:rRoutine,insights:rInsights,review:rReview,settings:rSettings})[page]()}

/* ---------- navigation & theme ---------- */
function show(p){
 page=p;$$('.page').forEach(x=>x.classList.toggle('on',x.id==='p-'+p));
 $$('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
 $('#side').classList.remove('open');window.scrollTo(0,0);renderAll();
}
function setTheme(t){S.settings.theme=t;document.body.classList.toggle('dark',t==='dark');save()}

/* ---------- export / import ---------- */
function dl(name,txt,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
function exportJSON(){dl('lifeflow-backup-'+today()+'.json',JSON.stringify({app:'LifeFlow',exported:new Date().toISOString(),transactions:S.transactions,journalEntries:S.journalEntries,activities:S.activities,budgets:S.budgets,settings:S.settings},null,2),'application/json');toast('Data exported')}
function exportCSV(){
 if(!S.transactions.length)return toast('No transactions to export');
 const c=v=>{v=String(v==null?'':v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
 const rows=[['Date','Type','Category','Description','Payment method','Amount','Notes']].concat(S.transactions.map(t=>[t.date,t.type,t.category,t.description,t.payment,t.amount,t.notes]));
 dl('lifeflow-transactions-'+today()+'.csv',rows.map(r=>r.map(c).join(',')).join('\n'),'text/csv');toast('Data exported');
}
function doImport(file){
 const fr=new FileReader();fr.onerror=()=>toast('Could not read that file');
 fr.onload=()=>{
  let d;try{d=JSON.parse(fr.result)}catch(e){return toast('That file is not valid JSON')}
  if(!d||typeof d!=='object'||Array.isArray(d)||!COLL.some(k=>Array.isArray(d[k])))return toast('That file does not look like a LifeFlow backup');
  const inc={};COLL.forEach(k=>inc[k]=(Array.isArray(d[k])?d[k]:[]).map(NORM[k]).filter(Boolean));
  const total=COLL.reduce((s,k)=>s+inc[k].length,0);if(!total)return toast('No valid records found in that file');
  showModal(`<div class="box"><h3>Import data</h3><p>Found ${inc.transactions.length} transactions, ${inc.journalEntries.length} journal entries, ${inc.activities.length} activities and ${inc.budgets.length} budgets.</p><div class="row"><button class="btn ghost" id="ic">Cancel</button><button class="btn ghost" id="im">Merge with existing data</button><button class="btn" id="ir">Replace existing data</button></div></div>`);
  $('#ic').onclick=closeModal;
  $('#im').onclick=()=>{COLL.forEach(k=>{const ids=new Set(S[k].map(x=>x.id));inc[k].forEach(x=>{if(!ids.has(x.id))S[k].push(x)})});finish()};
  $('#ir').onclick=()=>{if(!confirm('This will permanently replace all current data. Continue?'))return;COLL.forEach(k=>S[k]=inc[k]);applySettings(d.settings);finish()};
  function finish(){closeModal();setTheme(S.settings.theme);save();renderAll();toast('Data imported')}
 };
 fr.readAsText(file);
}
function demo(){
 if(!confirm('Add sample data to your records? You can remove it later with "Clear all data".'))return;
 let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647,pick=a=>a[Math.floor(rnd()*a.length)];
 for(let i=20;i>=0;i--){
  const d=addDays(today(),-i),wd=wday(d),wk=wd>0&&wd<6;
  const act=(name,category,st,en)=>S.activities.push({id:uid(),name,category,date:d,start:st,end:en,notes:''});
  const bed=1350+Math.floor(rnd()*100),study=rnd()<0.75,ex=rnd()<0.5;
  act('Sleep','Sleep',clock(bed),clock(bed+360+Math.floor(rnd()*120)));
  if(wk)act('College','College','09:00','15:30');else act('Friends','Social','15:00','18:00');
  if(ex)act('Workout','Exercise','17:00','18:00');
  if(study)act('Study session','Study','18:30','20:30');
  S.journalEntries.push({id:uid(),date:d,title:'Day notes',text:'Sample entry.',mood:pick(MOODS.slice(0,4)),productivity:clamp((study?6:4)+Math.floor(rnd()*4),1,10),energy:4+Math.floor(rnd()*6),tags:['demo']});
  S.transactions.push({id:uid(),date:d,type:'Expense',amount:Math.round(80+rnd()*220),category:'Food',description:'Meals',payment:pick(PAY),notes:''});
  if(wk)S.transactions.push({id:uid(),date:d,type:'Expense',amount:Math.round(40+rnd()*80),category:'Transport',description:'Commute',payment:'UPI',notes:''});
  if(rnd()<0.2)S.transactions.push({id:uid(),date:d,type:'Expense',amount:Math.round(200+rnd()*600),category:pick(['Entertainment','Shopping']),description:'Outing',payment:'Card',notes:''});
  if(i===10)S.transactions.push({id:uid(),date:d,type:'Income',amount:30000,category:'Other',description:'Allowance',payment:'Bank Transfer',notes:''});
 }
 if(!S.budgets.length)S.budgets.push({id:uid(),category:'Food',limit:5000},{id:uid(),category:'Entertainment',limit:1500});
 save();renderAll();toast('Demo data added');
}

/* ---------- init ---------- */
function init(){
 load();setTheme(S.settings.theme);
 $('#nav').innerHTML=PAGES.map(([k,l])=>`<button data-p="${k}">${l}</button>`).join('');
 $('#nav').onclick=e=>{const b=e.target.closest('button');if(b)show(b.dataset.p)};
 const fill=(id,o,all)=>$('#'+id).innerHTML=(all?`<option value="">${all}</option>`:'')+o.map(x=>`<option>${x}</option>`).join('');
 fill('m-cat',CATS,'All categories');fill('j-mood',MOODS,'All moods');fill('r-cat',ACAT,'All categories');fill('s-cat',CATS);
 for(let i=1;i<=10;i++)$('#j-prod').insertAdjacentHTML('beforeend',`<option value="${i}">Productivity ≥ ${i}</option>`);
 ['m-range','m-q','m-type','m-cat','m-date','m-sort','j-q','j-mood','j-prod','j-date','j-sort','r-tdate','r-cat','r-date','r-sort'].forEach(id=>{$('#'+id).addEventListener('input',renderAll)});
 $('#r-tdate').value=today();
 document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b&&ACT[b.dataset.a])ACT[b.dataset.a](b.dataset.id)});
 $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
 $('#b-addtx').onclick=()=>txForm();$('#b-csv').onclick=exportCSV;$('#b-addb').onclick=()=>budForm();
 $('#b-addj').onclick=()=>jForm();$('#b-adda').onclick=()=>aForm();
 $('#b-theme').onclick=()=>{setTheme(S.settings.theme==='dark'?'light':'dark');renderAll()};
 $('#menu').onclick=()=>$('#side').classList.toggle('open');
 $('#s-cur').onchange=e=>{S.settings.currency=e.target.value;save();renderAll()};
 $('#s-theme').onchange=e=>{setTheme(e.target.value);renderAll()};
 $('#s-cat').onchange=e=>{S.settings.defaultCategory=e.target.value;save()};
 $('#s-export').onclick=exportJSON;$('#s-demo').onclick=demo;
 $('#s-import').onclick=()=>$('#s-file').click();
 $('#s-file').onchange=e=>{if(e.target.files[0])doImport(e.target.files[0]);e.target.value=''};
 $('#s-clear').onclick=()=>{if(!confirm('Delete ALL transactions, journal entries, activities and budgets? This cannot be undone.'))return;COLL.forEach(k=>{S[k]=[];localStorage.removeItem('lf_'+k)});save();renderAll();toast('All data cleared')};
 window.addEventListener('resize',()=>{if(page==='money')rMoney()});
 show('dashboard');
}
init();
