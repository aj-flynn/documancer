// Runs inside every prototype frame, after `config` ({changes, options}) is defined by the renderer.
// It shows the variant for the options being viewed, marks and numbers the change points, jumps to one
// on request, and stops links and forms from leaving the prototype. The page outside drives it by message.
const off='data-documancer-off',tell=message=>parent.postMessage(message,'*');
let options={...config.options};
const holds=when=>{if(!when)return true;const [question,option]=when.split('=');return options[question]===option;};
const marks=id=>[...document.querySelectorAll('[data-change]')].filter(el=>el.getAttribute('data-change')===id);
function apply(){
  document.querySelectorAll('[data-when]').forEach(el=>el.toggleAttribute(off,!holds(el.getAttribute('data-when'))));
  const shown=[];
  for(const change of config.changes){
    const all=marks(change.id);
    all.forEach(el=>{el.removeAttribute('data-change-n');el.removeAttribute('data-change-anchor');});
    const live=holds(change.when)?all.filter(el=>!el.closest('['+off+']')):[];
    if(!live.length)continue;
    shown.push(change.id);
    live.forEach(el=>{el.setAttribute('data-change-n',shown.length);if(getComputedStyle(el).position==='static')el.setAttribute('data-change-anchor','');});
  }
  tell({documancer:'changes',shown});
}
function jump(id){
  const el=marks(id).find(el=>el.hasAttribute('data-change-n'));if(!el)return;
  el.scrollIntoView({block:'center',behavior:'auto'});
  el.removeAttribute('data-change-flash');void el.offsetWidth;el.setAttribute('data-change-flash','');
  setTimeout(()=>el.removeAttribute('data-change-flash'),1800);
}
addEventListener('message',event=>{
  if(event.source!==parent||!event.data)return;
  if(event.data.documancer==='options'){options={...event.data.options};apply();}
  if(event.data.documancer==='jump')jump(event.data.id);
});
document.addEventListener('click',event=>{
  const link=event.target.closest&&event.target.closest('a[href]');
  if(link&&!link.getAttribute('href').startsWith('#')){event.preventDefault();tell({documancer:'inert'});}
},true);
document.addEventListener('submit',event=>{event.preventDefault();tell({documancer:'inert'});},true);
addEventListener('keydown',event=>{if(event.key==='Escape')tell({documancer:'escape'});});
apply();tell({documancer:'ready'});
