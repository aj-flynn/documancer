// Static diagrams: placed by hand or by a layered layout, deterministic routing, no browser runtime.
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
// An optional change mark on a node or edge shows what a proposal adds, removes or alters.
const changes=['added','removed','changed'];
function change(value, path) { if (value !== undefined && !changes.includes(value)) fail(path+'.change','expected added, removed or changed'); }
const edgeText = e => [e.label, e.change && `(${e.change})`].filter(Boolean).join(' ');
const directions=['down','right'],maxCell=15,readingWidth=800; // the widest diagram the text column shows without scrolling
// Nodes are placed by hand when any of them has a row or column; otherwise the renderer places them.
const placedByHand = b => b.nodes.some(n => n.row!==undefined || n.column!==undefined);
export function validateDiagram(b, path) {
  fields(b,['type','caption','description','direction','nodes','edges'],path);
  text(b.caption,path+'.caption');text(b.description,path+'.description');
  if (b.direction!==undefined && !directions.includes(b.direction)) fail(path+'.direction','expected down or right');
  if (!Array.isArray(b.nodes) || !b.nodes.length || b.nodes.length > 40) fail(path+'.nodes','expected 1–40 nodes');
  if (!Array.isArray(b.edges) || b.edges.length > 80) fail(path+'.edges','expected 0–80 edges');
  const ids=new Set(), cells=new Set(), pairs=new Set(), manual=placedByHand(b);
  b.nodes.forEach((n,i)=>{
    const p=`${path}.nodes[${i}]`;fields(n,['id','label','row','column','change'],p);change(n.change,p);
    text(n.id,p+'.id');if (!/^[a-z][a-z0-9-]*$/.test(n.id)) fail(p+'.id','expected a lowercase slug');
    if (ids.has(n.id)) fail(p+'.id','duplicate node ID');ids.add(n.id);
    text(n.label,p+'.label',180);
    if (!manual) return;
    if (n.row===undefined && n.column===undefined) fail(p,'give every node a row and column, or leave them off every node so the renderer lays the diagram out');
    for (const key of ['row','column']) if (!Number.isInteger(n[key]) || n[key]<0 || n[key]>maxCell) fail(p+'.'+key,`expected an integer from 0 to ${maxCell}`);
    const cell=`${n.row},${n.column}`;if(cells.has(cell))fail(p,'two nodes occupy the same grid cell');cells.add(cell);
  });
  b.edges.forEach((e,i)=>{
    const p=`${path}.edges[${i}]`;fields(e,['from','to','label','change'],p);change(e.change,p);
    for(const key of ['from','to'])if(!ids.has(e[key]))fail(p+'.'+key,'unknown node ID');
    if(e.from===e.to)fail(p,'self edges are not supported; describe the repeat in text or use a separate step');
    const pair=`${e.from}:${e.to}`;if(pairs.has(pair))fail(p,'duplicate directed edge');pairs.add(pair);
    if(e.label!==undefined)text(e.label,p+'.label',48);
  });
  // An edge that cannot get lines of its own would be ambiguous, so it is an error.
  try{layout(b);}catch(error){if(error.edge===undefined)throw error;fail(`${path}.edges[${error.edge}]`,error.message);}
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
// Layout constants. Every edge gets lines of its own: tracks run `track` apart and
// at least `clear` from any box, and each edge leaves and enters a box at its own port.
const nodeWidth=200,margin=48,track=16,clear=24,hop=6;
const portsX=[0,-25,25,-50,50,-75,75],bendCost=40,crossCost=200,portCost=.4;
class Heap{
  constructor(){this.items=[];this.count=0;}
  get size(){return this.items.length;}
  less(a,b){return a.cost<b.cost||(a.cost===b.cost&&a.seq<b.seq);}
  push(cost,state){const a=this.items;a.push({cost,state,seq:this.count++});let i=a.length-1;while(i){const p=(i-1)>>1;if(!this.less(a[i],a[p]))break;[a[p],a[i]]=[a[i],a[p]];i=p;}}
  pop(){const a=this.items,top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<a.length&&this.less(a[l],a[m]))m=l;if(r<a.length&&this.less(a[r],a[m]))m=r;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}return top;}
}
const gapTracks=(start,end)=>{const n=Math.max(1,Math.floor((end-start-2*clear)/track)+1),mid=(start+end)/2;return Array.from({length:n},(_,i)=>mid+(i-(n-1)/2)*track);};
const outerTracks=size=>{const out=[];for(let p=margin-clear;p>=8;p-=track)out.push(p,size-p);return out;};
const moves=[[1,0,1],[-1,0,1],[0,1,2],[0,-1,2]]; // [dx, dy, axis]: 1 horizontal, 2 vertical
// Cheapest orthogonal path from a free port of one box to a free port of another.
// A line already used by another edge is never reused; it may only be crossed at a
// right angle, going straight through a point where that edge also goes straight.
function search(starts,goals,grid,used){
  const {NX,NY,xs,ys,blocked}=grid,dist=new Float64Array(NX*NY*3).fill(Infinity),prev=new Int32Array(NX*NY*3).fill(-1),heap=new Heap();
  for(const s of starts){const state=s.id*3,cost=Math.abs(s.o)*portCost;if(cost<dist[state]){dist[state]=cost;heap.push(cost,state);}}
  while(heap.size){
    const {cost,state}=heap.pop();if(cost>dist[state])continue;
    const id=Math.floor(state/3),axis=state%3;
    if(goals.has(id)){const path=[];for(let s=state;s>=0;s=prev[s])path.push(Math.floor(s/3));return path.reverse();}
    const i=Math.floor(id/NY),j=id%NY,through=used.points.has(id);
    for(const [di,dj,nextAxis] of moves){
      if(through&&nextAxis!==axis)continue;
      const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=NX||nj>=NY)continue;
      const next=ni*NY+nj;if(blocked[next]&&!goals.has(next))continue;
      if(used.segments.has(Math.min(id,next)*NX*NY+Math.max(id,next)))continue;
      const other=used.points.get(next);if(other&&(other.full||other.turn||other.axis===nextAxis))continue;
      const total=cost+Math.abs(xs[ni]-xs[i])+Math.abs(ys[nj]-ys[j])+(axis&&axis!==nextAxis?bendCost:0)+(other?crossCost:0),nextState=next*3+nextAxis;
      if(total<dist[nextState]){dist[nextState]=total;prev[nextState]=state;heap.push(total,nextState);}
    }
  }
  return null;
}
function simplify(points){return points.filter((p,i)=>!i||i===points.length-1||!((points[i-1][0]===p[0]&&points[i+1][0]===p[0])||(points[i-1][1]===p[1]&&points[i+1][1]===p[1])));}
const crossesBox=([a,b],box)=>a[1]===b[1]?a[1]>box.y0&&a[1]<box.y1&&Math.max(a[0],b[0])>box.x0&&Math.min(a[0],b[0])<box.x1:a[0]>box.x0&&a[0]<box.x1&&Math.max(a[1],b[1])>box.y0&&Math.min(a[1],b[1])<box.y1;
const overlaps=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1;
const grow=(box,by)=>({x0:box.x0-by,y0:box.y0-by,x1:box.x1+by,y1:box.y1+by});
const textWidth=line=>[...segments.segment(line)].reduce((sum,s)=>sum+units(s.segment)*14,0);
const median=list=>{const s=[...list].sort((p,q)=>p-q),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
// Automatic placement, a layered (Sugiyama) layout like Graphviz dot: break cycles, put each
// node in a layer along the flow, order every layer to cut crossings, then line nodes up with
// their neighbours. Every edge is kept; long edges pass through placeholder points that reserve
// room for them. Returns [layer, position] for each node.
function place(b,tuning){
  const n=b.nodes.length,index=new Map(b.nodes.map((node,k)=>[node.id,k])),out=b.nodes.map(()=>[]),fed=new Uint8Array(n);
  for(const e of b.edges){out[index.get(e.from)].push(index.get(e.to));fed[index.get(e.to)]=1;}
  // 1. Depth-first from the nodes nothing points to; an edge back to a node still being
  // visited closes a loop, and is turned round for layout only.
  const state=new Uint8Array(n),links=[];
  const visit=u=>{state[u]=1;for(const v of out[u]){if(state[v]===1)links.push([v,u]);else{links.push([u,v]);if(!state[v])visit(v);}}state[u]=2;};
  for(const u of [...out.keys()].sort((p,q)=>fed[p]-fed[q]||p-q))if(!state[u])visit(u);
  // 2. Layers: each node one past its furthest predecessor, then nodes move toward the side
  // with more edges while that shortens the total edge length.
  const preds=out.map(()=>[]),succs=out.map(()=>[]);for(const [u,v] of links){succs[u].push(v);preds[v].push(u);}
  const layer=new Array(n).fill(-1),depth=u=>layer[u]>=0?layer[u]:(layer[u]=Math.max(-1,...preds[u].map(depth))+1);
  out.forEach((_,u)=>depth(u));
  for(let moved=true;moved;){
    moved=false;
    for(let u=0;u<n;u++){
      const pull=succs[u].length-preds[u].length;if(!pull)continue;
      const want=pull<0?Math.max(0,...preds[u].map(p=>layer[p]+1)):Math.min(...succs[u].map(s=>layer[s]-1));
      if(want!==layer[u]){layer[u]=want;moved=true;}
    }
  }
  const lowest=Math.min(...layer);for(let u=0;u<n;u++)layer[u]-=lowest;
  // 3. An edge across several layers becomes a chain through one placeholder per layer.
  const rank=[...layer],up=out.map(()=>[]),down=out.map(()=>[]);
  for(const [u,v] of links){let prev=u;for(let l=layer[u]+1;l<=layer[v];l++){const next=l===layer[v]?v:rank.length;if(next!==v){rank.push(l);up.push([]);down.push([]);}down[prev].push(next);up[next].push(prev);prev=next;}}
  const layers=Array.from({length:Math.max(...rank)+1},()=>[]);rank.forEach((l,item)=>layers[l].push(item));
  // 4. Order each layer by the median position of its neighbours, sweeping down and up, and
  // swap neighbours wherever that removes crossings. Keep the best order seen.
  const pos=new Float64Array(rank.length),number=row=>row.forEach((item,k)=>pos[item]=k);layers.forEach(number);
  const crossings=l=>{const pairs=[];for(const p of layers[l])for(const q of down[p])pairs.push([pos[p],pos[q]]);let c=0;for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++)if((pairs[i][0]-pairs[j][0])*(pairs[i][1]-pairs[j][1])<0)c++;return c;};
  const around=l=>(l>0?crossings(l-1):0)+(l<layers.length-1?crossings(l):0),total=()=>layers.reduce((sum,_,l)=>sum+(l<layers.length-1?crossings(l):0),0);
  const transpose=()=>{for(let improved=true,pass=0;improved&&pass<8;pass++){improved=false;for(let l=0;l<layers.length;l++){const row=layers[l];for(let k=0;k+1<row.length;k++){const before=around(l);[row[k],row[k+1]]=[row[k+1],row[k]];number(row);if(around(l)<before)improved=true;else{[row[k],row[k+1]]=[row[k+1],row[k]];number(row);}}}}};
  let best=layers.map(row=>[...row]),fewest=total();
  for(let sweep=0;sweep<24&&fewest;sweep++){
    const downward=sweep%2===0,order=[...layers.keys()];if(!downward)order.reverse();
    for(const l of order.slice(1)){
      const key=new Map(layers[l].map(item=>{const near=(downward?up:down)[item];return [item,near.length?median(near.map(x=>pos[x])):pos[item]];}));
      layers[l].sort((p,q)=>key.get(p)-key.get(q)||pos[p]-pos[q]);number(layers[l]);
    }
    transpose();
    const count=total();if(count<fewest){fewest=count;best=layers.map(row=>[...row]);}
  }
  best.forEach((row,l)=>{layers[l]=row;number(row);})
  // 5. Positions. A run of placeholders in a layer is a lane: up to two pass through the gap
  // between boxes, more reserve an empty cell. Each box or wide lane aims for the median position
  // of its neighbours in the layer just placed; lanes go first so long edges run straight.
  const groups=layers.map(row=>{const list=[];for(const item of row){const lane=item>=n,last=list.at(-1);if(lane&&last?.lane)last.items.push(item);else list.push({lane,items:[item]});}return list;});
  const x=new Float64Array(rank.length),cols=groups.map(list=>{let c=0;return list.map(g=>g.lane&&g.items.length<tuning.lane?null:c++);});
  const spread=l=>{let left=(cols[l].find(c=>c!==null)??0)-1;groups[l].forEach((g,k)=>{const c=cols[l][k];if(c!==null)left=c;for(const item of g.items)x[item]=c??left+.5;});};
  groups.forEach((_,l)=>spread(l));
  for(let pass=0;pass<tuning.passes;pass++){
    const downward=pass%2===0,both=pass>=tuning.directional,order=[...layers.keys()];if(!downward)order.reverse();
    for(const l of both?order:order.slice(1)){
      const wide=groups[l].map((g,k)=>k).filter(k=>cols[l][k]!==null),at=wide.map(k=>cols[l][k]),fixed=wide.map(()=>false);
      const near=wide.map(k=>groups[l][k].items.flatMap(item=>both?[...up[item],...down[item]]:(downward?up:down)[item]).map(y=>x[y]));
      const priority=wide.map((k,w)=>groups[l][k].lane?1000:near[w].length);
      for(const w of [...wide.keys()].sort((p,q)=>priority[q]-priority[p]||p-q)){
        if(near[w].length){
          let lo=w,hi=Infinity;
          for(let j=w-1;j>=0;j--)if(fixed[j]){lo=at[j]+w-j;break;}
          for(let j=w+1;j<at.length;j++)if(fixed[j]){hi=at[j]-(j-w);break;}
          at[w]=Math.max(lo,Math.min(hi,Math.round(median(near[w]))));
          for(let j=w+1;j<at.length&&at[j]<at[j-1]+1;j++)at[j]=at[j-1]+1;
          for(let j=w-1;j>=0&&at[j]>at[j+1]-1;j--)at[j]=at[j+1]-1;
        }
        fixed[w]=true;
      }
      wide.forEach((k,w)=>cols[l][k]=at[w]);spread(l);
    }
  }
  // A column with no box in any layer is closed up; its edges use the gaps instead.
  const used=[...new Set(b.nodes.map((_,u)=>x[u]))].sort((p,q)=>p-q),column=new Map(used.map((c,k)=>[c,k]));
  return b.nodes.map((_,u)=>[layer[u],column.get(x[u])]);
}
// Candidate placements: as authored, or the layered layout with a few settings for how many
// placeholders make a lane wide and how long columns follow one side before both.
const variants=[{lane:2,passes:12,directional:4},{lane:3,passes:12,directional:4},{lane:99,passes:12,directional:4},{lane:3,passes:4,directional:4},{lane:99,passes:4,directional:4}];
// Without a direction, both are tried.
function candidates(b){
  if(placedByHand(b))return [{cells:b.nodes.map(n=>[n.row,n.column]),direction:b.direction}];
  const seen=new Map();
  for(const direction of b.direction?[b.direction]:directions)for(const tuning of variants){
    const cells=place(b,tuning).map(([l,p])=>direction==='right'?[p,l]:[l,p]),key=JSON.stringify(cells);
    if(!seen.has(key))seen.set(key,{cells,direction});
  }
  return [...seen.values()];
}
// Routing is retried with wider gaps, so a crowded diagram gets more lines before it is rejected.
// Of the automatic candidates, the one with the fewest crossings wins. Then the narrowest past the
// document's text column, since a tall diagram scrolls with the page but a wide one scrolls on its own;
// then top to bottom; then the smallest area.
function route(b,cells){
  for(let attempt=0;;attempt++){
    try{return arrange(b,cells,attempt,attempt===3);}
    catch(error){if(error.edge===undefined||attempt===3)throw error;}
  }
}
const cache=new Map();
function layout(b){
  const key=JSON.stringify([b.nodes,b.edges,b.direction]);
  if(cache.has(key))return cache.get(key);
  let best,failure;
  const rank=r=>[r.crossings,Math.max(0,r.width-readingWidth),r.direction==='right'?1:0,r.width*r.height];
  const better=(p,q)=>{const a=rank(p),c=rank(q);for(let k=0;k<a.length;k++)if(a[k]!==c[k])return a[k]<c[k];return false;};
  for(const {cells,direction} of candidates(b)){
    try{const result={...route(b,cells),direction};if(!best||better(result,best))best=result;}
    catch(error){if(error.edge===undefined)throw error;failure??=error;}
  }
  if(!best)throw failure;
  if(cache.size>=64)cache.delete(cache.keys().next().value);
  cache.set(key,best);return best;
}
function arrange(b,cells,attempt,last){
  const nodes=b.nodes.map((n,k)=>({...n,row:cells[k][0],column:cells[k][1],lines:wrap(n.label,9.5)}));
  const gapX=144+attempt*64,columns=Math.max(...nodes.map(n=>n.column))+1,rows=Math.max(...nodes.map(n=>n.row))+1;
  // Rows sit as close as their tracks allow; a labelled edge adds room for its label.
  const gapY=Math.max(80,...b.edges.map(e=>edgeText(e)?wrap(edgeText(e),8).length*18+72:0))+attempt*48;
  const heights=Array.from({length:rows},(_,r)=>Math.max(92,...nodes.filter(n=>n.row===r).map(n=>n.lines.length*22+36)));
  const lefts=Array.from({length:columns},(_,c)=>margin+c*(nodeWidth+gapX)),tops=[];let bottom=margin;
  for(const height of heights){tops.push(bottom);bottom+=height+gapY;}
  const width=margin*2+columns*nodeWidth+(columns-1)*gapX,height=bottom-gapY+margin;
  const portsY=r=>{const out=[0];for(let k=1;k<=Math.floor((heights[r]/2-20)/24);k++)out.push(-k*24,k*24);return out;};
  const xset=new Set(outerTracks(width)),yset=new Set(outerTracks(height));
  lefts.forEach((x,c)=>{xset.add(x);xset.add(x+nodeWidth);for(const o of portsX)xset.add(x+nodeWidth/2+o);if(c<columns-1)for(const t of gapTracks(x+nodeWidth,lefts[c+1]))xset.add(t);});
  tops.forEach((y,r)=>{yset.add(y);yset.add(y+heights[r]);for(const o of portsY(r))yset.add(y+heights[r]/2+o);if(r<rows-1)for(const t of gapTracks(y+heights[r],tops[r+1]))yset.add(t);});
  const xs=[...xset].sort((p,q)=>p-q),ys=[...yset].sort((p,q)=>p-q),NX=xs.length,NY=ys.length;
  const xi=new Map(xs.map((v,i)=>[v,i])),yi=new Map(ys.map((v,i)=>[v,i])),blocked=new Uint8Array(NX*NY);
  const boxes=nodes.map(n=>({x0:lefts[n.column],y0:tops[n.row],x1:lefts[n.column]+nodeWidth,y1:tops[n.row]+heights[n.row]}));
  for(const box of boxes)for(let i=xi.get(box.x0);i<=xi.get(box.x1);i++)for(let j=yi.get(box.y0);j<=yi.get(box.y1);j++)blocked[i*NY+j]=1;
  const ports=nodes.map((n,k)=>{
    const box=boxes[k],cx=(box.x0+box.x1)/2,cy=(box.y0+box.y1)/2,list=[];
    for(const o of portsX)list.push({x:cx+o,y:box.y0,o},{x:cx+o,y:box.y1,o});
    for(const o of portsY(n.row))list.push({x:box.x0,y:cy+o,o},{x:box.x1,y:cy+o,o});
    return list.map(p=>({...p,id:xi.get(p.x)*NY+yi.get(p.y)}));
  });
  const grid={NX,NY,xs,ys,blocked},used={points:new Map(),segments:new Set(),ports:new Set()},index=new Map(nodes.map((n,k)=>[n.id,k]));
  const span=e=>{const f=nodes[index.get(e.from)],t=nodes[index.get(e.to)];return Math.abs(f.row-t.row)+Math.abs(f.column-t.column);};
  const grids=[],hops=b.edges.map(()=>[]);let crossings=0;
  // Short edges are routed first, so neighbours get the straight lines.
  for(const i of b.edges.map((_,i)=>i).sort((p,q)=>span(b.edges[p])-span(b.edges[q])||p-q)){
    const e=b.edges[i],free=k=>ports[index.get(k)].filter(p=>!used.ports.has(p.id));
    const path=search(free(e.from),new Set(free(e.to).map(p=>p.id)),grid,used);
    if(!path){const error=new Error('cannot be drawn without sharing a line with another edge; give the node fewer edges, place the connected nodes closer together, or split the diagram');error.edge=i;throw error;}
    const axisOf=(p,q)=>Math.floor(p/NY)===Math.floor(q/NY)?2:1;
    for(let k=1;k<path.length-1;k++){
      const p=path[k],before=axisOf(path[k-1],p),after=axisOf(p,path[k+1]),other=used.points.get(p);
      // Where two edges cross, the horizontal one hops over the vertical one.
      if(other){other.full=true;crossings++;hops[before===1?i:other.edge].push(p);}
      else used.points.set(p,{axis:before,edge:i,turn:before!==after});
    }
    for(let k=1;k<path.length;k++)used.segments.add(Math.min(path[k-1],path[k])*NX*NY+Math.max(path[k-1],path[k]));
    used.ports.add(path[0]);used.ports.add(path.at(-1));grids[i]=path;
  }
  const at=id=>[xs[Math.floor(id/NY)],ys[id%NY]];
  const routes=grids.map(path=>simplify(path.map(at))),hopPoints=hops.map(list=>list.map(at));
  const edgeSegments=routes.map(points=>points.slice(1).map((p,k)=>[points[k],p]));
  // A label goes on the longest stretch of its own edge where it covers no box, other edge or label:
  // on the line, or just beside it. A label with no such place widens the gaps like a crowded edge,
  // and only at the widest is it allowed to overlap.
  const labels=[],length=([a,c])=>Math.abs(c[0]-a[0])+Math.abs(c[1]-a[1]);
  b.edges.forEach((e,i)=>{
    if(!edgeText(e))return;
    const lines=wrap(edgeText(e),8),h=lines.length*18+12,w=Math.ceil(Math.max(...lines.map(textWidth)))+20;
    const candidates=[...edgeSegments[i]].sort((p,q)=>length(q)-length(p));
    const place=(seg,t,side=0)=>{const across=seg[0][0]===seg[1][0];const x=Math.max(w/2+2,Math.min(width-w/2-2,seg[0][0]+(seg[1][0]-seg[0][0])*t+(across?side*(w/2+6):0))),y=seg[0][1]+(seg[1][1]-seg[0][1])*t+(across?0:side*(h/2+4));return {x,y,box:{x0:x-w/2,y0:y-h/2,x1:x+w/2,y1:y+h/2}};};
    const fits=({box})=>box.y0>=0&&box.y1<=height&&!boxes.some(n=>overlaps(grow(n,4),box))&&!labels.some(l=>overlaps(grow(l.box,4),box))&&!edgeSegments.some((list,k)=>k!==i&&list.some(s=>crossesBox(s,box)));
    let spot;for(const side of [0,1,-1]){for(const seg of candidates){for(const t of [.5,.35,.65]){const s=place(seg,t,side);if(fits(s)){spot=s;break;}}if(spot)break;}if(spot)break;}
    if(!spot&&!last){const error=new Error('has no room for its label');error.edge=i;throw error;}
    labels.push({...(spot??place(candidates[0],.5)),w,h,lines});
  });
  return {nodes,boxes,width,height,routes,hopPoints,labels,crossings};
}
function pathData(points,hopPoints){
  let d=`M ${points[0].join(' ')}`;
  for(let k=1;k<points.length;k++){
    const [x1,y1]=points[k-1],[x2,y2]=points[k];
    if(y1===y2){const dir=Math.sign(x2-x1);for(const [x] of hopPoints.filter(([x,y])=>y===y1&&(x-x1)*(x-x2)<0).sort((p,q)=>(p[0]-q[0])*dir))d+=` L ${x-hop*dir} ${y1} A ${hop} ${hop} 0 0 ${dir>0?1:0} ${x+hop*dir} ${y1}`;}
    d+=` L ${x2} ${y2}`;
  }
  return d;
}
function textSVG(lines,x,y,lineHeight,css){return `<text class="${css}" text-anchor="middle">${lines.map((line,i)=>`<tspan x="${x}" y="${y+(i-(lines.length-1)/2)*lineHeight}">${escape(line)}</tspan>`).join('')}</text>`;}
export function diagramHTML(b, id) {
  const {nodes,boxes,width,height,routes,hopPoints,labels}=layout(b),byID=new Map(nodes.map(n=>[n.id,n]));
  const paths=b.edges.map((edge,i)=>`<path class="diagram-edge${edge.change?' diagram-'+edge.change:''}" d="${pathData(routes[i],hopPoints[i])}" marker-end="url(#${id}-arrow${edge.change?'-'+edge.change:''})"/>`);
  const labelSVG=labels.map(l=>`<g><rect class="diagram-label-bg" x="${l.box.x0}" y="${l.box.y0}" width="${l.w}" height="${l.h}" rx="4"/>${textSVG(l.lines,l.x,l.y+5,18,'diagram-edge-label')}</g>`);
  const nodeSVG=nodes.map((n,k)=>{const box=boxes[k],cx=(box.x0+box.x1)/2,cy=(box.y0+box.y1)/2;return `<g class="diagram-node${n.change?' diagram-'+n.change:''}"><rect x="${box.x0}" y="${box.y0}" width="${nodeWidth}" height="${box.y1-box.y0}" rx="10"/>${textSVG(n.lines,cx,cy+6,22,'diagram-node-label')}${n.change?`<text class="diagram-change-tag" x="${box.x0+2}" y="${box.y0-8}">${n.change[0].toUpperCase()+n.change.slice(1)}</text>`:''}</g>`;});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="diagram-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${escape(b.caption)}</title><desc id="${id}-desc">${escape(b.description)}</desc><defs>${['',...changes.filter(c=>b.edges.some(e=>e.change===c))].map(c=>`<marker id="${id}-arrow${c&&'-'+c}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="diagram-arrow${c&&' diagram-'+c}"/></marker>`).join('')}</defs>${paths.join('')}${nodeSVG.join('')}${labelSVG.join('')}</svg>`;
  const alternative=`<details class="diagram-text"><summary>Text description</summary><p>${escape(b.description)}</p><ul class="prose-list">${nodes.map(n=>`<li>${escape(n.id)}: ${escape(n.label)}${n.change?` (${n.change})`:''}</li>`).join('')}${b.edges.map(e=>`<li>${escape(byID.get(e.from).label)} → ${escape(byID.get(e.to).label)}${edgeText(e)?': '+escape(edgeText(e)):''}</li>`).join('')}</ul></details>`;
  return `<figure class="diagram"><figcaption><span>${escape(b.caption)}</span></figcaption><p class="diagram-hint">Scroll horizontally if needed. A text description follows the diagram.</p><div class="expand-wrap"><button class="diagram-expand expand-button" type="button" aria-haspopup="dialog" hidden>Expand<span class="sr-only"> diagram</span></button><div class="diagram-scroll" tabindex="0" role="region" aria-label="${escape(b.caption)}">${svg}</div></div>${alternative}</figure>`;
}

// Advice for an author. A diagram that breaks these still renders, but is likely hard to read.
export function diagramWarnings(b) {
  const out=[],{crossings,nodes,direction}=layout(b),manual=placedByHand(b),plural=(n,one,many)=>n===1?one:many,named=list=>list.join(', ');
  const degree=new Map(b.nodes.map(n=>[n.id,0]));for(const e of b.edges){degree.set(e.from,degree.get(e.from)+1);degree.set(e.to,degree.get(e.to)+1);}
  const lone=b.nodes.length>1?b.nodes.filter(n=>!degree.get(n.id)).map(n=>n.id):[];
  if(lone.length)out.push(`${named(lone)} ${plural(lone.length,'has','have')} no edges; connect ${plural(lone.length,'it','them')} or leave ${plural(lone.length,'it','them')} out`);
  if(crossings)out.push(`${crossings} edge ${plural(crossings,'crossing','crossings')}, drawn with a hop; ${manual?'reorder nodes within their rows so connected nodes line up, leave out every row and column so the renderer lays the diagram out, or split the diagram':'the automatic layout could not avoid them, so split the diagram or use a table'}`);
  const at=new Map(nodes.map(n=>[n.id,n])),deltas=b.edges.map(e=>[at.get(e.to).row-at.get(e.from).row,at.get(e.to).column-at.get(e.from).column]);
  const down=direction?direction==='down':deltas.reduce((s,[r])=>s+Math.abs(r),0)>=deltas.reduce((s,[,c])=>s+Math.abs(c),0),along=([r,c])=>down?r:c,name=e=>`${e.from} → ${e.to}`;
  // An edge against the flow is fine when it closes a loop: its target already leads back to its source.
  const reaches=(start,goal,skipped)=>{const seen=new Set([start]),todo=[start];while(todo.length){const id=todo.pop();if(id===goal)return true;for(const e of b.edges)if(e!==skipped&&e.from===id&&!seen.has(e.to)){seen.add(e.to);todo.push(e.to);}}return false;};
  const back=b.edges.filter((e,k)=>along(deltas[k])<0&&!reaches(e.to,e.from,e)).map(name);
  if(back.length)out.push(`${named(back)} ${plural(back.length,'points','point')} ${down?'up':'left'}, against the ${down?'top-to-bottom':'left-to-right'} flow, and ${plural(back.length,'is not','are not')} a loop back; reorder the ${down?'rows':'columns'} so arrows point ${down?'down':'right'}`);
  if(b.nodes.length>12)out.push(`${b.nodes.length} nodes; more than 12 is hard to read, so split the diagram`);
  if(b.edges.length>6&&b.edges.length>b.nodes.length*1.5)out.push(`${b.edges.length} edges for ${b.nodes.length} nodes; more than 1.5 edges per node is hard to follow, so split the diagram or use a table for a many-to-many relationship`);
  // A diagram about one node, which connects to every other node, is that node's own diagram.
  const hubs=[...degree].filter(([,d])=>d>5&&d<b.nodes.length-1).map(([id,d])=>`${id} (${d})`);
  if(hubs.length)out.push(`${named(hubs)} ${plural(hubs.length,'has','have')} more than 5 edges; give ${plural(hubs.length,'it','each')} a diagram of ${plural(hubs.length,'its','their')} own, or use a table`);
  return out;
}
// Warnings for every diagram in a document, each with the path of its block.
export function documentDiagramWarnings(value, path='') {
  if(Array.isArray(value))return value.flatMap((v,i)=>documentDiagramWarnings(v,`${path}[${i}]`));
  if(!value||typeof value!=='object')return [];
  if(value.type==='diagram'&&Array.isArray(value.nodes))return diagramWarnings(value).map(w=>`${path}: ${w}`);
  return Object.entries(value).flatMap(([k,v])=>documentDiagramWarnings(v,path?`${path}.${k}`:k));
}
