export const categories=['裝修','傢俱','家電','廁所','廚房','其他'];export const statuses=['待比較','已選定','已下單','已到貨','已取消'];
export const loan=()=>({amount:0,rate:0,years:30,grace:0,start:'2026-10',prepayments:[]});
export const empty=()=>({schema:1,items:[],budgets:Object.fromEntries(categories.map(c=>[c,{limit:0,enabled:false,loan:loan()}])),house:{price:0,down:0,own:0,family:0,cap:10000000,manual:false},mortgages:[loan(),loan()]});
export function cost(i){return i.price===null||i.price===''||i.price===undefined?null:Number(i.price)*Number(i.quantity)+Number(i.fee||0)-Number(i.discount||0);}
export function paid(i){return (i.payments||[]).reduce((s,p)=>s+Number(p.amount),0);}
export function totals(items,limit=0){let allocated=0,ordered=0,unpaid=0,estimated=0,payment=0,attention=0;for(const i of items){let c=cost(i),p=paid(i);payment+=p;if(i.status==='已取消'){if(Math.abs(p)>.005)attention++;continue;}if(c===null)estimated++;if(i.include&&c!==null)allocated+=c;if(['已下單','已到貨'].includes(i.status)&&c!==null){ordered+=c;unpaid+=Math.max(0,c-p);}if(c!==null&&p>c+.005)attention++;}return {allocated,ordered,unpaid,estimated,paid:payment,remaining:limit-allocated,attention};}
export function monthAt(start,n){const [y,m]=start.split('-').map(Number),d=new Date(Date.UTC(y,m-1+n,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
const annuity=(p,r,n)=>n<=0?p:r===0?p/n:p*r/(1-Math.pow(1+r,-n));
export const youthStages=()=>[{offset:0,rate:1.775},{offset:36,rate:1.9},{offset:48,rate:2.025},{offset:60,rate:2.15},{offset:72,rate:2.275}];
export function rateAt(l,month){if(l.rateMode!=='youth3')return Number(l.rate);let rate=l.stages[0].rate;for(const s of l.stages)if(month>=monthAt(l.disbursed,s.offset))rate=s.rate;return Number(rate);}
const term=(p,r,payment)=>p<=1e-7?0:r===0?Math.ceil(p/payment-1e-9):Math.ceil(-Math.log(1-p*r/payment)/Math.log(1+r)-1e-9);
export function schedule(l,extra=true){const n=Math.round(Number(l.years)*12),g=Math.round(Number(l.grace)*12);let balance=Number(l.amount),reference=balance,maturity=n,shortGrace=false,previousRate=null,rows=[];const graceRate=rateAt(l,monthAt(l.start,g))/1200;let payment=annuity(balance,graceRate,n-g);if(!balance)return rows;if(!(n>0&&g>=0&&g<n&&balance>=0))throw Error('貸款年限須大於寬限期，金額不得為負');
for(let k=0;k<maturity&&balance>1e-7;k++){const month=monthAt(l.start,k),rate=rateAt(l,month),r=rate/1200;
if(k===g){payment=annuity(reference,r,n-g);if(shortGrace)maturity=Math.min(n,g+term(balance,r,payment));else payment=annuity(balance,r,n-g);}
else if(k>g&&r!==previousRate)payment=annuity(balance,r,maturity-k);
const interest=balance*r,normal=k<g?interest:k===maturity-1?balance+interest:Math.min(balance+interest,payment),principal=Math.min(balance,Math.max(0,normal-interest));balance-=principal;let prepayment=0;
for(const e of extra?(l.prepayments||[]).filter(e=>e.month===month):[]){if(Number(e.amount)>balance+1e-7)throw Error(`${month} 提前還款超過當期正常月付後剩餘本金`);prepayment+=Number(e.amount);balance=Math.max(0,balance-Number(e.amount));
if(e.mode==='reduce'){maturity=n;if(k<g){reference=balance;shortGrace=false;payment=annuity(balance,graceRate,n-g);}else payment=annuity(balance,r,n-k-1);}
else if(k<g)shortGrace=true;
else maturity=Math.min(maturity,k+1+term(balance,r,payment));}
rows.push({month,rate,payment:normal,principal,interest,prepayment,balance});previousRate=r;}return rows;}
// 合併採顯示至元的月付相同、連續且同年；額外本金獨立列於月份。
export function group(rows){let groups=[];for(const row of rows){let last=groups.at(-1);if(last&&last.end.slice(0,4)===row.month.slice(0,4)&&monthAt(last.end,1)===row.month&&Math.round(last.payment)===Math.round(row.payment)){last.end=row.month;last.count++;if(row.prepayment)last.extras.push([row.month,row.prepayment]);}else groups.push({start:row.month,end:row.month,count:1,payment:row.payment,extras:row.prepayment?[[row.month,row.prepayment]]:[]});}return groups;}
export function combine(loans){let map=new Map();for(const l of loans)for(const r of schedule(l)){let row=map.get(r.month)||{month:r.month,payment:0,prepayment:0};row.payment+=r.payment;row.prepayment+=r.prepayment;map.set(r.month,row);}return [...map.values()].sort((a,b)=>a.month.localeCompare(b.month));}
export function loansFor(d){let need=Math.max(0,d.house.price-d.house.down),a=Math.min(need,d.house.cap);return [...d.mortgages.map((l,k)=>({...l,...(k===0&&!l.rateMode?{rateMode:'youth3',disbursed:l.start,stages:youthStages()}:{}),amount:d.house.manual?l.amount:k===0?a:need-a})),...categories.filter(c=>d.budgets[c].enabled).map(c=>d.budgets[c].loan)];}
export function validate(d){
if(d?.schema!==1||!Array.isArray(d.items)||!d.house||!d.budgets||d.mortgages?.length!==2)throw Error('備份格式不相容');
const nonnegative=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
for(const k of ['price','down','own','family','cap'])if(!nonnegative(d.house[k]))throw Error('房屋與資金金額無效');
if(d.house.down>d.house.price)throw Error('自備款不得超過房價');
for(const c of categories)if(!d.budgets[c]||!nonnegative(d.budgets[c].limit))throw Error('分類預算無效');
const ids=new Set();for(const i of d.items){
if(!i.id||ids.has(i.id)||!String(i.name||'').trim()||!['商品','工程'].includes(i.type)||!Array.isArray(i.spaces)||!Array.isArray(i.tags)||!Array.isArray(i.quotes)||!Array.isArray(i.payments))throw Error('品項資料格式無效');ids.add(i.id);
if(!categories.includes(i.category)||!statuses.includes(i.status)||!nonnegative(i.quantity)||i.quantity<=0||!nonnegative(i.fee)||!nonnegative(i.discount)||(i.price!==null&&!nonnegative(i.price))||(cost(i)!==null&&cost(i)<0))throw Error('品項金額或分類無效');
for(const u of [i.url,...i.quotes.map(q=>q.url)])if(u){let parsed;try{parsed=new URL(u);}catch{throw Error('商品網址無效');}if(!['http:','https:'].includes(parsed.protocol))throw Error('網址僅允許 http/https');}
for(const q of i.quotes)if(q.price!==null&&!nonnegative(q.price))throw Error('比價金額無效');
for(const p of i.payments)if(typeof p.amount!=='number'||!Number.isFinite(p.amount)||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))throw Error('付款紀錄無效');}
for(const l of [...d.mortgages,...categories.map(c=>d.budgets[c].loan)]){
if(![l.amount,l.rate,l.years,l.grace].every(nonnegative)||l.years<=l.grace||l.years>100||!/^\d{4}-(0[1-9]|1[0-2])$/.test(l.start)||!Array.isArray(l.prepayments))throw Error('貸款設定無效（年限須大於寬限，最多 100 年）');
if(l.rateMode==='youth3'){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(l.disbursed)||l.disbursed>l.start||!Array.isArray(l.stages)||l.stages.length!==5||!l.stages.every((s,k)=>s.offset===[0,36,48,60,72][k]&&nonnegative(s.rate)))throw Error('青安 3.0 撥貸年月或五階段利率無效');if(l.years>40||l.grace>5)throw Error('青安 3.0 試算最長 40 年、寬限最長 5 年');}
for(const p of l.prepayments)if(!nonnegative(p.amount)||p.amount<=0||!['reduce','shorten'].includes(p.mode)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)||p.month<l.start||p.month>=monthAt(l.start,Math.round(l.years*12)))throw Error('提前還款年月或金額無效');}
for(const l of loansFor(d))schedule(l);return d;
}

