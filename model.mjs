export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const STORAGE_KEY = 'pause.balance.v1';
export const CATALOG = [
 {id:'instagram',name:'Instagram',category:'Social',color:'#ba6a91'},
 {id:'tiktok',name:'TikTok',category:'Entertainment',color:'#343e3e'},
 {id:'youtube',name:'YouTube',category:'Entertainment',color:'#dc7e72'},
 {id:'x',name:'X',category:'Social',color:'#748183'},
 {id:'facebook',name:'Facebook',category:'Social',color:'#5c83bd'},
 {id:'reddit',name:'Reddit',category:'Social',color:'#d98b61'},
 {id:'netflix',name:'Netflix',category:'Entertainment',color:'#ae5257'},
 {id:'pinterest',name:'Pinterest',category:'Inspiration',color:'#b75e6b'},
 {id:'snapchat',name:'Snapchat',category:'Social',color:'#d0b94a'},
 {id:'discord',name:'Discord',category:'Social',color:'#8981c0'}
];
export function dayKey(d = new Date()) {
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
export function dateOffset(key, offset) {const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+offset);return dayKey(d);}
export function makeInitial(date=dayKey()) {
 const apps=[{id:'instagram',limit:60,used:42,bonus:0},{id:'tiktok',limit:30,used:26,bonus:0},{id:'youtube',limit:45,used:30,bonus:0},{id:'x',limit:15,used:10,bonus:0}];
 const totals=[212,195,228,178,202,180,194,165,182,147,170,136,124];
 const history=totals.map((total,i)=>({date:dateOffset(date,i-13),used:total,limit:i<7?210:180,tasks:i%3+2,apps:{instagram:Math.round(total*.4),tiktok:Math.round(total*.25),youtube:Math.round(total*.25),x:total-Math.round(total*.4)-2*Math.round(total*.25)},sample:true}));
 return {version:1,date,apps,points:40,spent:0,cap:60,pendingCap:null,remindBefore:5,sessionReminder:20,notifications:false,reminders:true,
 tasks:[{id:'task-walk',title:'Take a walk outside',category:'Wellbeing',points:20,done:false,created:date},{id:'task-room',title:'Tidy up my space',category:'Chores',points:20,done:false,created:date},{id:'task-read',title:'Read 10 pages',category:'Personal goal',points:30,done:false,created:date},{id:'task-water',title:'Water the plants',category:'Chores',points:10,done:true,completed:date,created:date}],
 history,activity:[{id:'welcome',title:'Welcome to a little more balance',body:'Start with a task, or try the demo to see your app limits in action.',time:Date.now(),read:false}],notified:{},sessions:{},
 transactions:[{id:'starter',title:'Sample task rewards',points:40,date,time:Date.now(),type:'earned'}],onboarded:false};
}
export function dailySnapshot(s) {return {date:s.date,used:s.apps.reduce((n,a)=>n+a.used,0),limit:s.apps.reduce((n,a)=>n+a.limit+a.bonus,0),tasks:s.tasks.filter(t=>t.completed===s.date).length,apps:Object.fromEntries(s.apps.map(a=>[a.id,a.used])),sample:true};}
export function rollDay(s,date=dayKey()) {
 if(s.date===date)return false;
 s.history=s.history.filter(h=>h.date!==s.date);s.history.push(dailySnapshot(s));s.history=s.history.sort((a,b)=>a.date.localeCompare(b.date)).slice(-90);
 s.date=date;s.apps.forEach(a=>{a.used=0;a.bonus=0;});s.spent=0;s.notified={};s.sessions={};
 if(s.pendingCap!==null){s.cap=s.pendingCap;s.pendingCap=null;}
 return true;
}
export function completeTask(s,id) {
 const task=s.tasks.find(t=>t.id===id);
 if(!task||task.done)return {ok:false,error:'This task has already been completed.'};
 task.done=true;task.completed=s.date;s.points+=task.points;
 s.transactions.unshift({id:uid(),title:task.title,points:task.points,date:s.date,time:Date.now(),type:'earned'});
 return {ok:true,points:task.points};
}
export function redeem(s,appId,minutes) {
 const app=s.apps.find(a=>a.id===appId);const cost=minutes*2;
 if(!app)return {ok:false,error:'Choose an app to add time to.'};
 if(![5,10,15].includes(minutes))return {ok:false,error:'Choose a valid time reward.'};
 if(s.spent+cost>s.cap)return {ok:false,error:'That would exceed your daily spending limit.'};
 if(cost>s.points)return {ok:false,error:'Complete another task to earn enough points.'};
 s.points-=cost;s.spent+=cost;app.bonus+=minutes;
 const meta=CATALOG.find(a=>a.id===appId);
 s.transactions.unshift({id:uid(),title:`${minutes} extra minutes · ${meta.name}`,points:-cost,date:s.date,time:Date.now(),type:'spent'});
 delete s.notified[appId+'-near'];delete s.notified[appId+'-limit'];
 return {ok:true,cost,minutes,app:meta.name};
}
export function addUsage(s,appId,minutes) {
 const a=s.apps.find(a=>a.id===appId);if(!a||!Number.isInteger(minutes)||minutes<=0)return {ok:false,error:'Choose an app and a positive number of minutes.'};
 const remaining=Math.max(0,a.limit+a.bonus-a.used);const added=Math.min(remaining,minutes);a.used+=added;s.sessions[appId]=(s.sessions[appId]||0)+added;
 const rest=Math.max(0,a.limit+a.bonus-a.used);const alerts=[];const name=CATALOG.find(x=>x.id===appId).name;
 const task=s.tasks.find(t=>!t.done);const taskHint=task?`Take a break and ${task.title.charAt(0).toLowerCase()+task.title.slice(1)}.`:'Step away for a moment. A little fresh air feels good.';
 if(rest===0&&!s.notified[appId+'-limit']){alerts.push({title:`Time to pause ${name}`,body:`Your daily limit is reached. ${taskHint} You can also use points for a little extra time.`,type:'limit',appId});s.notified[appId+'-limit']=true;}
 else if(rest>0&&rest<=s.remindBefore&&!s.notified[appId+'-near']){alerts.push({title:`${name}: ${rest} minutes left`,body:taskHint,type:'near',appId});s.notified[appId+'-near']=true;}
 if(rest>0&&s.sessions[appId]>=s.sessionReminder){if(!alerts.length)alerts.push({title:'A little break goes a long way',body:`You've spent ${s.sessions[appId]} demo minutes on ${name}. ${taskHint}`,type:'break',appId});s.sessions[appId]=0;}
 return {ok:true,added,locked:rest===0,alerts};
}
export function changeLimit(s,id,limit) {const a=s.apps.find(a=>a.id===id);if(!a||!Number.isInteger(limit)||limit<5||limit>480)return false;a.limit=limit;delete s.notified[id+'-near'];delete s.notified[id+'-limit'];return true;}
export function weekData(s,offset=0) {
 const all=[...s.history.filter(x=>x.date!==s.date),dailySnapshot(s)];
 return Array.from({length:7},(_,i)=>{const date=dateOffset(s.date,i-6-offset*7);return all.find(x=>x.date===date)||{date,used:0,limit:0,tasks:0,apps:{},sample:true,missing:true};});
}
