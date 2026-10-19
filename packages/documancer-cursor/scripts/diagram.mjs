// Static diagrams: explicit grid placement, deterministic routing, no browser runtime.
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
function fields(value, allowed, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path,'expected an object');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}`,'unknown field');
}
function text(value, path, limit) {
  if (typeof value !== 'string' || !value.trim()) fail(path,'expected a nonempty string');
  if (limit && [...value].length > limit) fail(path,`must not exceed ${limit} characters`);
}
export function validateDiagram(b, path) {
  fields(b,['type','caption','description','nodes','edges'],path);
  text(b.caption,path+'.caption');text(b.description,path+'.description');
  if (!Array.isArray(b.nodes) || !b.nodes.length || b.nodes.length > 40) fail(path+'.nodes','expected 1–40 nodes');
  if (!Array.isArray(b.edges) || b.edges.length > 80) fail(path+'.edges','expected 0–80 edges');
  const ids=new Set(), cells=new Set(), pairs=new Set();
  b.nodes.forEach((n,i)=>{
    const p=`${path}.nodes[${i}]`;fields(n,['id','label','row','column'],p);
    text(n.id,p+'.id');if (!/^[a-z][a-z0-9-]*$/.test(n.id)) fail(p+'.id','expected a lowercase slug');
    if (ids.has(n.id)) fail(p+'.id','duplicate node ID');ids.add(n.id);
    text(n.label,p+'.label',180);
    for (const key of ['row','column']) if (!Number.isInteger(n[key]) || n[key]<0 || n[key]>7) fail(p+'.'+key,'expected an integer from 0 to 7');
    const cell=`${n.row},${n.column}`;if(cells.has(cell))fail(p,'two nodes occupy the same grid cell');cells.add(cell);
  });
  b.edges.forEach((e,i)=>{
    const p=`${path}.edges[${i}]`;fields(e,['from','to','label'],p);
    for(const key of ['from','to'])if(!ids.has(e[key]))fail(p+'.'+key,'unknown node ID');
    if(e.from===e.to)fail(p,'self edges are not supported; describe the repeat in text or use a separate step');
    const pair=`${e.from}:${e.to}`;if(pairs.has(pair))fail(p,'duplicate directed edge');pairs.add(pair);
    if(e.label!==undefined)text(e.label,p+'.label',48);
  });
}

const segments = new Intl.Segmenter('en',{granularity:'grapheme'});
const units = char => /[MW@%]/.test(char)?1:/[ilI.,'!:;|]/.test(char)?.3:/[A-Z0-9]/.test(char)?.7:/[\u0000-\u007f]/.test(char)?.58:1.2;
function wrap(text, max) {
  const lines=[];let line='',width=0;
  for(const word of text.trim().split(/\s+/u)) {
    const chars=[...segments.segment(word)].map(s=>s.segment),size=chars.reduce((sum,c)=>sum+units(c),0);
    if(line && width+.58+size>max){lines.push(line);line='';width=0;}
    if(line){line+=' ';width+=.58;}
    for(const char of chars){const size=units(char);if(line&&width+size>max){lines.push(line);line='';width=0;}line+=char;width+=size;}
  }
  if(line)lines.push(line);return lines;
}
const key=(x,y)=>`${x},${y}`;
const segmentKey=(a,b)=>[key(...a),key(...b)].sort().join(':');
// Route on alternating node-center / empty-corridor grid lines. Occupied centers
// are obstacles; the corridors leave room for labels and arrowheads.
function route(start,end,xs,ys,occupied,used) {
  const initial={point:start,dir:'',cost:0,path:[start]},queue=[initial],best=new Map();
  while(queue.length){
    queue.sort((a,b)=>b.cost-a.cost);const current=queue.pop(),[x,y]=current.point;
    const state=key(x,y)+current.dir;if((best.get(state)??Infinity)<current.cost)continue;
    if(x===end[0]&&y===end[1])return current.path;
    for(const [dx,dy,dir] of [[1,0,'h'],[0,1,'v'],[-1,0,'h'],[0,-1,'v']]){
      const next=[x+dx,y+dy],[nx,ny]=next;
      if(nx<0||ny<0||nx>=xs.length||ny>=ys.length)continue;
      if(occupied.has(key(nx,ny))&&key(nx,ny)!==key(...end))continue;
      const cost=current.cost+Math.abs(xs[nx]-xs[x])+Math.abs(ys[ny]-ys[y])+(current.dir&&current.dir!==dir?40:0)+(used.get(segmentKey(current.point,next))??0)*180;
      const state=key(nx,ny)+dir;
      if(cost>=(best.get(state)??Infinity))continue;
      best.set(state,cost);queue.push({point:next,dir,cost,path:[...current.path,next]});
    }
  }
  throw new Error('Unable to route diagram edge');
}
function simplify(points){return points.filter((p,i)=>!i||i===points.length-1||!((points[i-1][0]===p[0]&&points[i+1][0]===p[0])||(points[i-1][1]===p[1]&&points[i+1][1]===p[1])));}
function textSVG(lines,x,y,lineHeight,css){return `<text class="${css}" text-anchor="middle">${lines.map((line,i)=>`<tspan x="${x}" y="${y+(i-(lines.length-1)/2)*lineHeight}">${escape(line)}</tspan>`).join('')}</text>`;}
export function diagramHTML(b, id) {
  const nodeWidth=200, gapX=144, margin=112;
  const gapY=Math.max(112,...b.edges.map(e=>e.label?wrap(e.label,8).length*18+48:0));
  const nodes=b.nodes.map(n=>({...n,lines:wrap(n.label,9.5)}));
  const columns=Math.max(...nodes.map(n=>n.column))+1, rows=Math.max(...nodes.map(n=>n.row))+1;
  const heights=Array.from({length:rows},(_,r)=>Math.max(92,...nodes.filter(n=>n.row===r).map(n=>n.lines.length*22+36)));
  const xs=Array.from({length:columns*2+1},(_,i)=>i%2?margin+nodeWidth/2+Math.floor(i/2)*(nodeWidth+gapX):i===0?margin/2:margin+nodeWidth+gapX/2+(i/2-1)*(nodeWidth+gapX));
  const tops=[];let bottom=margin;
  for(const height of heights){tops.push(bottom);bottom+=height+gapY;}
  const ys=Array.from({length:rows*2+1},(_,i)=>i%2?tops[Math.floor(i/2)]+heights[Math.floor(i/2)]/2:i===0?margin/2:tops[i/2-1]+heights[i/2-1]+gapY/2);
  const width=margin*2+columns*nodeWidth+(columns-1)*gapX,height=bottom-gapY+margin;
  const occupied=new Set(nodes.map(n=>key(n.column*2+1,n.row*2+1))),used=new Map(),byID=new Map(nodes.map(n=>[n.id,n]));
  const paths=[],labels=[];
  for(const edge of b.edges){
    const from=byID.get(edge.from),to=byID.get(edge.to);
    const grid=route([from.column*2+1,from.row*2+1],[to.column*2+1,to.row*2+1],xs,ys,occupied,used);
    for(let i=1;i<grid.length;i++){const k=segmentKey(grid[i-1],grid[i]);used.set(k,(used.get(k)??0)+1);}
    const points=simplify(grid.map(([x,y])=>[xs[x],ys[y]]));
    for(const [index,neighbor,node] of [[0,1,from],[points.length-1,points.length-2,to]]){
      const p=points[index],q=points[neighbor];
      if(p[0]===q[0])p[1]+=Math.sign(q[1]-p[1])*heights[node.row]/2;
      else p[0]+=Math.sign(q[0]-p[0])*nodeWidth/2;
    }
    paths.push(`<path class="diagram-edge" d="M ${points.map(p=>p.join(' ')).join(' L ')}" marker-end="url(#${id}-arrow)"/>`);
    if(edge.label){
      const candidates=points.slice(1).map((p,i)=>({a:points[i],b:p,length:Math.abs(p[0]-points[i][0])+Math.abs(p[1]-points[i][1])}));
      const {a,b:point}=candidates.sort((a,b)=>b.length-a.length)[0];
      const lines=wrap(edge.label,8),h=lines.length*18+12;
      const w=Math.ceil(Math.max(...lines.map(line=>[...segments.segment(line)].reduce((sum,s)=>sum+units(s.segment)*14,0))))+20;
      const x=Math.max(w/2+2,Math.min(width-w/2-2,(a[0]+point[0])/2)),y=(a[1]+point[1])/2;
      labels.push(`<g><rect class="diagram-label-bg" x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="4"/>${textSVG(lines,x,y+5,18,'diagram-edge-label')}</g>`);
    }
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="diagram-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${escape(b.caption)}</title><desc id="${id}-desc">${escape(b.description)}</desc><defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="diagram-arrow"/></marker></defs>${paths.join('')}${nodes.map(n=>`<g class="diagram-node"><rect x="${xs[n.column*2+1]-nodeWidth/2}" y="${tops[n.row]}" width="${nodeWidth}" height="${heights[n.row]}" rx="10"/>${textSVG(n.lines,xs[n.column*2+1],ys[n.row*2+1]+6,22,'diagram-node-label')}</g>`).join('')}${labels.join('')}</svg>`;
  const alternative=`<details class="diagram-text"><summary>Text description</summary><p>${escape(b.description)}</p><ul class="prose-list">${nodes.map(n=>`<li>${escape(n.id)}: ${escape(n.label)}</li>`).join('')}${b.edges.map(e=>`<li>${escape(byID.get(e.from).label)} → ${escape(byID.get(e.to).label)}${e.label?': '+escape(e.label):''}</li>`).join('')}</ul></details>`;
  return `<figure class="diagram"><figcaption><span>${escape(b.caption)}</span><button class="diagram-expand" type="button" aria-haspopup="dialog" hidden>Expand diagram</button></figcaption><p class="diagram-hint">Scroll horizontally if needed. A text description follows the diagram.</p><div class="diagram-scroll" tabindex="0" role="region" aria-label="${escape(b.caption)}">${svg}</div>${alternative}</figure>`;
}
