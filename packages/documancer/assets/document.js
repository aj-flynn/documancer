(() => {
  const menu=document.querySelector('.handbook-menu');
  const narrow=typeof matchMedia==='function'?matchMedia('(max-width:760px)'):{matches:false,addEventListener(){}};
  const setMenu=()=>menu.open=!narrow.matches;setMenu();narrow.addEventListener?.('change',setMenu);
  const sections=[...document.querySelectorAll('.article>section')];
  const nav=[...document.querySelectorAll('.sidebar nav a')];
  const search=document.querySelector('#doc-search');
  nav.forEach(a=>a.addEventListener('click',()=>{if(narrow.matches)menu.open=false}));
  search.addEventListener('input',()=>{
    const query=search.value.trim().toLowerCase();let count=0;
    nav.forEach(a=>{const section=document.getElementById(a.hash.slice(1));const match=!query||`${a.textContent} ${section.textContent}`.toLowerCase().includes(query);a.hidden=!match;if(match)count++});
    document.querySelector('.search-feedback').textContent=query?(count?`${count} matching topic${count===1?'':'s'}`:'No matching topics. Try a shorter search.'):'';
    if(query)menu.open=true;
  });
  search.addEventListener('keydown',e=>{if(e.key==='Escape'){search.value='';search.dispatchEvent(new Event('input'))}if(e.key==='Enter')nav.find(a=>!a.hidden)?.click()});
  let scheduled=false;
  function current(){document.querySelector('.sidebar').style.setProperty('--sidebar-offset',Math.max(0,document.querySelector('.doc-layout').getBoundingClientRect().top)+'px');const active=sections.filter(s=>s.getBoundingClientRect().top<=74).at(-1)||sections[0];nav.forEach(a=>{if(a.hash==='#'+active.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});scheduled=false}
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(current)}},{passive:true});addEventListener('resize',current);current();
  document.querySelectorAll('.copy-code').forEach(button=>button.addEventListener('click',async()=>{
    const code=button.closest('.code-example').querySelector('code');
    try{await navigator.clipboard.writeText(code.textContent);document.querySelector('.live-message').textContent='Code copied to clipboard.'}
    catch{const range=document.createRange();range.selectNodeContents(code);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.querySelector('.live-message').textContent='Clipboard access was blocked. Code selected; press Ctrl+C or Command+C.'}
  }));
  const diagrams=[...document.querySelectorAll('.diagram')];
  if(diagrams.length && typeof HTMLDialogElement!=='undefined' && typeof HTMLDialogElement.prototype.showModal==='function'){
    const dialog=document.createElement('dialog');dialog.className='diagram-dialog';dialog.setAttribute('aria-label','Expanded diagram');
    dialog.innerHTML='<div class="diagram-dialog-toolbar"><strong></strong><button type="button">Close diagram</button></div><p>Scroll to explore. Press Escape or Close diagram to return.</p><div class="diagram-dialog-scroll" tabindex="0" role="region" aria-label="Expanded diagram canvas"></div>';
    document.body.append(dialog);
    const canvas=dialog.querySelector('.diagram-dialog-scroll');let opener,previousOverflow;
    function fitDiagram(){
      const svg=canvas.querySelector('svg');if(!dialog.open||!svg)return;
      const width=Number(svg.getAttribute('width')),height=Number(svg.getAttribute('height'));
      const scale=Math.max(1,Math.min((canvas.clientWidth-2)/width,(canvas.clientHeight-2)/height));
      svg.style.width=width*scale+'px';svg.style.height=height*scale+'px';
    }
    addEventListener('resize',fitDiagram);
    function expand(figure,trigger){
      if(dialog.open)return;
      const svg=figure.querySelector('.diagram-svg').cloneNode(true);
      svg.querySelectorAll('[id]').forEach(element=>element.id+='-expanded');
      svg.setAttribute('aria-labelledby',svg.getAttribute('aria-labelledby').split(' ').map(id=>id+'-expanded').join(' '));
      svg.querySelectorAll('[marker-end]').forEach(element=>element.setAttribute('marker-end',element.getAttribute('marker-end').replace(')', '-expanded)')));
      const title=figure.querySelector('figcaption span').textContent;
      dialog.querySelector('strong').textContent=title;dialog.setAttribute('aria-label',title+' — expanded diagram');
      canvas.replaceChildren(svg);opener=trigger;previousOverflow=document.body.style.overflow;
      dialog.showModal();document.body.style.overflow='hidden';fitDiagram();canvas.scrollTop=0;canvas.scrollLeft=0;
    }
    function closeDiagram(){
      if(!dialog.open)return;
      dialog.close();canvas.replaceChildren();document.body.style.overflow=previousOverflow;opener?.focus({preventScroll:true});
    }
    dialog.querySelector('button').addEventListener('click',closeDiagram);
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeDiagram();});
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const close=dialog.querySelector('button');
      if(event.shiftKey&&document.activeElement===close){event.preventDefault();canvas.focus();}
      else if(!event.shiftKey&&document.activeElement===canvas){event.preventDefault();close.focus();}
    });
    addEventListener('beforeprint',closeDiagram);
    diagrams.forEach(figure=>{
      const button=figure.querySelector('.diagram-expand'),region=figure.querySelector('.diagram-scroll');button.hidden=false;
      button.addEventListener('click',()=>expand(figure,button));
      region.classList.add('diagram-expandable');
      region.setAttribute('aria-description','Click the diagram or press Enter to expand. Arrow keys scroll.');
      region.addEventListener('click',event=>{if(event.target.closest('.diagram-svg')&&!getSelection()?.toString())expand(figure,region);});
      region.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();expand(figure,region);}});
    });
  }
  let closedDetails=[];
  addEventListener('beforeprint',()=>{closedDetails=[...document.querySelectorAll('.article details:not([open])')];closedDetails.forEach(d=>d.open=true)});
  addEventListener('afterprint',()=>closedDetails.forEach(d=>d.open=false));
  const tests=[...document.querySelectorAll('[data-test]')];if(!tests.length)return;
  const data=JSON.parse(document.querySelector('#document-data').textContent);
  const labels=['Passed','Failed','Skipped','Blocked','Untested'];
  const state=document.querySelector('#summary-state'),output=document.querySelector('#summary-text'),button=document.querySelector('#generate-summary');let revision=0;
  const results=()=>tests.map(t=>({id:t.dataset.test,title:t.dataset.title,result:t.querySelector('input:checked').value,notes:t.querySelector('textarea').value}));
  const counts=()=>labels.map(s=>`${s}: ${results().filter(r=>r.result===s).length}`).join(' · ');
  function printValues(){tests.forEach(t=>{t.querySelector('.print-result').textContent='Result: '+t.querySelector('input:checked').value;t.querySelector('.print-notes').textContent='Notes: '+(t.querySelector('textarea').value||'(none)')});document.querySelector('#print-summary').textContent=output.value?(revision===generatedRevision?output.value:'Summary is out of date. Generate again.\n\n'+output.value):'No summary generated.'}
  let generatedRevision=-1;
  function changed(){revision++;document.querySelector('#result-counts').textContent=counts();if(output.value)state.textContent='Results changed. Generate summary again to include the latest results and notes.';printValues()}
  tests.forEach(t=>t.addEventListener('input',changed));document.querySelector('#result-counts').textContent=counts();printValues();
  button.addEventListener('click',async()=>{
    const version=revision;button.disabled=true;
    const evidence=data.evidence.length?data.evidence.map(e=>`${e.title} — ${e.status}\n${e.detail}${e.history?'\nHistory: '+e.history:''}`).join('\n\n'):'No automated evidence supplied.';
    output.value=[data.title,data.identity,'Generated: '+new Date().toISOString(),'','Human acceptance',counts(),...results().map(r=>`\n${r.id} — ${r.title}\nResult: ${r.result}\nNotes: ${r.notes.trim()||'(none)'}`),'','Automated evidence (separate from human acceptance)',evidence,'','Skipped and untested tests remain unaccepted.'].join('\n');
    generatedRevision=version;printValues();
    try{await navigator.clipboard.writeText(output.value);state.textContent=version===revision?'Summary generated and copied. Ready to paste.':'Summary copied, but results changed. Generate again for the latest results.'}
    catch{output.focus();output.select();state.textContent=version===revision?'Summary generated. Clipboard access was blocked; text is selected. Press Ctrl+C or Command+C to copy.':'Results changed while generating. Generate again before copying.'}
    finally{button.disabled=false}
  });
})();
