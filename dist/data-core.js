(function(root){
function hash(s){return [...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7)}
function rate(id,year){const h=hash(id),t=(year-1990)/35;return Math.max(2,Math.min(84,8+(h%4300)/100+((h%1800)/100-3)*t+1.2*Math.sin(t*4+h%9)*t))}
function weight(id){return 1+hash(id)%10}
function national(ids,year){const w=ids.reduce((s,id)=>s+weight(id),0);return ids.reduce((s,id)=>s+rate(id,year)*weight(id),0)/w}
function change(id,a,b,ids){const f=y=>id==='all'?national(ids,y):rate(id,y);return f(b)-f(a)}
const api={rate,national,change,weight};if(typeof module!=='undefined')module.exports=api;else root.ForestDemo=api;
})(typeof window!=='undefined'?window:globalThis);
