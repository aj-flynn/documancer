// Preview mode runtime: response controls, the prototype banner, the decision block and the summary.
// Nothing is sent anywhere unless the host supplied a submit address, and then only on an explicit click.
(() => {
  const info=JSON.parse(document.querySelector('#document-data').textContent),preview=info.preview;
  const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const labels={ok:'Yes',change:'Change',question:'Question',drop:'Drop',later:'Later'},tones={ok:'passed',change:'skipped',later:'skipped',question:'asked',drop:'failed'},rules={ok:'Optional.',change:'Required: what should change?',question:'Required: what is your question?',drop:'Required: why drop it?',later:'Required: why later, and what should happen first?'},decisions={approve:'Approve','send-back':'Send back',reject:'Reject ticket',reviewed:'Finish review'};
  const live=$('.live-message'),overall=$('#decision-note'),primary=$('#decision-primary'),reject=$('#decision-reject'),bulk=$('#ok-remaining');
  const dots=$$('[data-dot]'),meter=$('.meter i'),barCount=$('.answer-count'),go=$('.rail-button');
  const dot=(id,tone)=>dots.filter(x=>x.dataset.dot===id).forEach(x=>{if(tone)x.dataset.result=tone;else delete x.dataset.result;});
  const state=$('#summary-state'),output=$('#summary-text'),counts=$('#decision-counts'),openList=$('#decision-open');
  const questions=preview.questions.map(q=>{const el=$$('[data-question]').find(x=>x.dataset.question===q.id);return {...q,el,note:$('textarea',el),problem:$('.response-problem',el)};});
  const views=preview.views.map(v=>{const el=$$('[data-view]').find(x=>x.dataset.view===v.id);return {...v,el,frame:$('.proto-frame',el),radios:$$('input[type=radio]',el).filter(r=>/-response$/.test(r.name)),note:$('textarea',el),problem:$('.response-problem',el)};});
  const responding=views.filter(v=>!v.informational);
  const question=id=>questions.find(q=>q.id===id);
  const choice=q=>$('.choice-options input:checked',q.el)?.value??null;
  const optionLabel=(q,id)=>id==='none'?'None of these':`${id} · ${q.options.find(o=>o.id===id).label}`;
  const response=v=>v.radios.find(r=>r.checked)?.value??null;
  const viewing=v=>Object.fromEntries($$('.proto-switch',v.el).map(f=>[f.dataset.switch,$('input:checked',f)?.value]));
  const send=v=>v.frame?.contentWindow?.postMessage({documancer:'options',options:viewing(v)},'*');
  // The options an OK applies to: the choices made, or what was on screen when no choice exists yet.
  const optionsFor=v=>Object.fromEntries(v.varies.map(id=>{const c=choice(question(id));return [id,c&&c!=='none'?c:v.ok?.options?.[id]??viewing(v)[id]];}));
  const withOptions=options=>{const text=Object.entries(options).map(([q,o])=>`${q} = ${o}`).join(', ');return text?' with '+text:'';};
  let revision=0,generated=-1,readable='';

  // An OK belongs to what was on screen. If a choice now differs from the option a view was OK'd with, the OK is withdrawn and the view says why.
  function reconcile(){
    for(const v of responding){
      if(response(v)!=='ok'||!v.ok||v.ok.bulk)continue;
      for(const id of v.varies){
        const chosen=choice(question(id)),seen=v.ok.options?.[id];
        if(!chosen||chosen==='none'||seen===chosen)continue;
        v.radios.forEach(r=>r.checked=false);v.ok=null;
        v.problem.textContent=`Your Yes was for ${id} = ${seen??'an earlier option'}. You chose ${chosen}, so look at this view with ${chosen} and answer again.`;
        break;
      }
    }
  }
  function status(){
    const open=[];
    for(const q of questions){const c=choice(q);if(!c)open.push({id:q.id,text:`${q.id} has no choice`});else if(c==='none'&&!q.note.value.trim())open.push({id:q.id,text:`${q.id}: None of these needs a note`,note:true});}
    for(const v of responding){const r=response(v);if(!r)open.push({id:v.id,text:`${v.id} has no answer`});else if(r!=='ok'&&!v.note.value.trim())open.push({id:v.id,text:`${v.id}: ${labels[r]} needs a note`,note:true});}
    const notOK=responding.some(v=>response(v)&&response(v)!=='ok')||questions.some(q=>choice(q)==='none');
    // A review finishes once something is answered and no answer lacks its note; unanswered views stay unanswered.
    if(preview.review)return {open,notOK,action:!open.some(o=>o.note)&&(responding.some(response)||questions.some(choice))?'reviewed':null};
    return {open,notOK,action:!open.length&&!notOK?'approve':notOK&&!open.some(o=>o.note)?'send-back':null};
  }
  function show(){
    const {open,notOK,action}=status();
    for(const q of questions){const c=choice(q);$$('[data-item]').filter(x=>x.dataset.item===q.id).forEach(mark=>{mark.textContent=c?(c==='none'?'None of these':c):'No choice';if(c)mark.dataset.result=c==='none'?'skipped':'asked';else delete mark.dataset.result;});dot(q.id,c?(c==='none'?'skipped':'asked'):null);
      q.el.querySelector('.print-result').textContent=q.id+' choice: '+(c?optionLabel(q,c):'(none made)');q.el.querySelector('.print-notes').textContent='Note: '+(q.note.value.trim()||'(none)');}
    for(const v of responding){const r=response(v);$$('[data-item]').filter(x=>x.dataset.item===v.id).forEach(mark=>{mark.textContent=r?labels[r]+(r==='ok'&&v.ok?.bulk?' (bulk)':''):'No response';if(r)mark.dataset.result=tones[r];else delete mark.dataset.result;});dot(v.id,r?tones[r]:null);
      $('.note-rule',v.el).textContent=r?rules[r]:'Required for every answer except Yes.';
      v.el.querySelector('.print-result').textContent=v.id+' response: '+(r?labels[r]+(r==='ok'?withOptions(optionsFor(v))+(v.ok?.bulk?' (bulk Yes)':''):''):'(none given)');v.el.querySelector('.print-notes').textContent='Note: '+(v.note.value.trim()||'(none)');}
    const total=questions.length+responding.length,done=questions.filter(choice).length+responding.filter(response).length;
    if(meter)meter.style.width=100*done/total+'%';if(barCount)barCount.textContent=done===total?'Everything is answered.':`${total-done} of ${total} to answer`;go?.toggleAttribute('data-ready',done===total);
    $$('.test-progress').forEach(p=>{const note=document.createElement('span');note.className='screen-only';note.textContent=' Responses stay in this tab only.';p.replaceChildren(done===total?'Everything is answered.':`${total-done} of ${total} still need your answer.`,note);});
    for(const q of questions)for(const v of views.filter(v=>v.varies.includes(q.id))){
      const c=choice(q),seen=viewing(v)[q.id],text=$$('.proto-switch',v.el).find(f=>f.dataset.switch===q.id).querySelector('.proto-chosen');
      text.textContent=`Viewing ${optionLabel(q,seen)}. `+(!c?'Not chosen yet.':c==='none'?'You chose None of these.':c===seen?'This is your choice.':`Your choice is ${c}.`);
    }
    const waiting=open.filter(o=>!o.note).length;
    counts.textContent=preview.review?(action?(waiting?`You can finish the review now. ${waiting} item${waiting===1?' has':'s have'} no answer and will stay unanswered.`:'Everything is answered. You can finish the review.'):`${open.length} item${open.length===1?' needs':'s need'} you before you can finish:`):action==='approve'?'Everything is answered Yes. You can approve.':action==='send-back'?(waiting?`You can send this back now. ${waiting} item${waiting===1?' has':'s have'} no response and will stay unanswered.`:'Everything is answered. Some answers are not Yes, so this goes back to the agent.'):`${open.length} item${open.length===1?' needs':'s need'} you before you can approve:`;
    openList.replaceChildren(...open.map(o=>{const item=document.createElement('li'),link=document.createElement('a');link.href='#'+o.id;link.textContent=o.text;item.append(link);return item;}));
    primary.textContent=preview.review?'Finish review':action==='send-back'?'Send back':'Approve';primary.setAttribute('aria-disabled',String(!action));
    const remaining=responding.filter(v=>!response(v)).length;
    bulk.textContent=remaining?`Yes to all remaining views (${remaining})`:'No views remaining';bulk.setAttribute('aria-disabled',String(!remaining));
    // Paper gets the readable part of the summary; the data block after it is for the ticket.
    $('#print-summary').textContent=readable?(generated===revision?readable:'This summary is out of date. Choose an action again.\n\n'+readable):'';
  }
  function changed(){revision++;reconcile();show();if(output.value)state.textContent='Your responses changed after this summary was written. Choose an action again to include them.';}

  $('.article').addEventListener('input',event=>{
    const target=event.target;if(target===output)return;
    const v=views.find(v=>v.el.contains(target)),q=questions.find(q=>q.el.contains(target));
    if(v&&v.radios.includes(target)){v.ok=target.value==='ok'?{options:viewing(v),bulk:false}:null;v.problem.textContent='';}
    if(v&&/-viewing-/.test(target.name||''))send(v);
    if(q&&/-choice$/.test(target.name||'')&&target.value!=='none')follow(q,target.value);
    changed();
  });
  // A choice is one value shown in two places: every prototype that varies by the question switches to it.
  function follow(q,value){
    for(const v of views.filter(v=>v.varies.includes(q.id))){
      const input=$$('.proto-switch',v.el).find(f=>f.dataset.switch===q.id).querySelector(`input[value="${CSS.escape(value)}"]`);
      if(input){input.checked=true;send(v);}
    }
  }
  $$('.proto-choose').forEach(button=>button.addEventListener('click',()=>{
    const field=button.closest('.proto-switch'),q=question(field.dataset.switch),value=$('input:checked',field).value;
    $$('.choice-options input',q.el).find(input=>input.value===value).checked=true;
    follow(q,value);changed();live.textContent=`${q.id}: ${value} chosen.`;
  }));
  bulk.addEventListener('click',()=>{
    const remaining=responding.filter(v=>!response(v));if(!remaining.length)return;
    remaining.forEach(v=>{v.radios.find(r=>r.value==='ok').checked=true;v.ok={options:null,bulk:true};v.problem.textContent='';});
    changed();live.textContent=`${remaining.length} view${remaining.length===1?'':'s'} answered Yes in bulk.`;
  });

  // Prototype frames: option switch, jump links and Expand. The frame stays in place so its state survives expanding.
  function showChanges(v,shown){
    if(!Array.isArray(shown))return;
    $$('[data-jump]',v.el).forEach(button=>{const n=shown.indexOf(button.dataset.jump);button.dataset.label??=button.textContent;button.hidden=n<0;button.textContent=`${n+1} · ${button.dataset.label}`;});
    $('.proto-count',v.el).textContent=`${shown.length} change${shown.length===1?'':'s'} on this screen. Jump to:`;
  }
  for(const v of views.filter(v=>v.frame)){
    const dialog=$('.proto',v.el),button=$('.proto-expand',dialog);$('.proto-controls',dialog).hidden=false;
    $$('[data-jump]',v.el).forEach(jump=>jump.addEventListener('click',()=>v.frame.contentWindow.postMessage({documancer:'jump',id:jump.dataset.jump},'*')));
    v.frame.addEventListener('load',()=>send(v));send(v);
    if(typeof dialog.showModal!=='function')continue;
    let expanded=false,overflow,scroll;button.hidden=false;
    v.collapse=()=>{
      if(!expanded)return;expanded=false;
      dialog.close();dialog.show();document.body.style.overflow=overflow;scrollTo(0,scroll);
      button.textContent='Expand';button.setAttribute('aria-expanded','false');button.focus({preventScroll:true});
    };
    button.addEventListener('click',()=>{
      if(expanded)return v.collapse();
      expanded=true;overflow=document.body.style.overflow;scroll=scrollY;
      dialog.close();dialog.showModal();document.body.style.overflow='hidden';
      button.textContent='Close';button.setAttribute('aria-expanded','true');button.focus();
    });
    dialog.addEventListener('cancel',event=>{event.preventDefault();v.collapse();});
    addEventListener('beforeprint',v.collapse);
  }
  addEventListener('message',event=>{
    const v=views.find(v=>v.frame&&v.frame.contentWindow===event.source);if(!v||!event.data)return;
    if(event.data.documancer==='ready')send(v);
    if(event.data.documancer==='changes')showChanges(v,event.data.shown);
    if(event.data.documancer==='inert')live.textContent='That control is not part of the prototype.';
    if(event.data.documancer==='escape')v.collapse?.();
  });

  // One response shape for the ticket service and, as text, for the summary.
  function build(decision){
    const result={ticket:preview.ticket.number,version:preview.ticket.version,decision,okRemaining:responding.some(v=>response(v)==='ok'&&v.ok?.bulk),views:{},questions:{},note:overall.value.trim()};
    for(const v of responding){
      const r=response(v);if(!r)continue;
      const entry={response:r},note=v.note.value.trim(),options=optionsFor(v);
      if(r==='ok'&&Object.keys(options).length)entry.options=options;
      if(r==='ok'&&v.ok?.bulk)entry.bulk=true;
      if(note)entry.note=note;
      result.views[v.id]=entry;
    }
    for(const q of questions){const c=choice(q);if(!c)continue;const note=q.note.value.trim();result.questions[q.id]=note?{choice:c,note}:{choice:c};}
    return result;
  }
  // The summary a person reads. The text that is copied or sent adds the same response as data.
  function summary(result){
    const viewLine=v=>{const entry=result.views[v.id];return `${v.id} — ${v.title}: ${entry?labels[entry.response]+withOptions(entry.options??{})+(entry.bulk?' (bulk Yes)':''):'(no response)'}${entry?.note?'\n  Note: '+entry.note:''}`;};
    const questionLine=q=>{const entry=result.questions[q.id];return `${q.id} — ${q.title}: ${entry?optionLabel(q,entry.choice):'(no choice)'}${entry?.note?'\n  Note: '+entry.note:''}`;};
    return [`Preview response · ${preview.ticket.repository} #${preview.ticket.number} · preview version ${preview.ticket.version}`,info.title,info.identity,'Generated: '+new Date().toISOString(),'',`Decision: ${decisions[result.decision]}`,`Overall note: ${result.note||'(none)'}`,...(questions.length?['','Questions',...questions.map(questionLine)]:[]),'','Views',...responding.map(viewLine)].join('\n');
  }
  async function act(decision){
    const version=revision,result=build(decision);
    readable=summary(result);output.value=readable+'\n\nResponse data\n'+JSON.stringify(result,null,2);generated=version;show();
    let failure='';
    primary.disabled=true;if(reject)reject.disabled=true;
    try{
      if(preview.submitUrl){
        state.textContent='Sending your response…';
        try{
          const answer=await fetch(preview.submitUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});
          if(!answer.ok)throw new Error('the ticket service answered '+answer.status);
          state.textContent=`${decisions[decision]} sent to ticket #${preview.ticket.number}.`;return;
        }catch(error){failure=`Your response was not sent (${error.message}). Nothing was lost: every entry is still on this page, and the summary below can be pasted into the ticket. `;}
      }
      const head=failure||`${decisions[decision]} written to the summary. `;
      try{await navigator.clipboard.writeText(output.value);state.textContent=head+`Summary copied. Paste it into ticket #${preview.ticket.number}.`;}
      catch{output.focus();output.select();state.textContent=head+'Clipboard access was blocked; the text is selected. Press Ctrl+C or Command+C to copy.';}
    }finally{primary.disabled=false;if(reject)reject.disabled=false;}
  }
  primary.addEventListener('click',()=>{
    const {action,open}=status();
    if(action)return act(action);
    state.textContent=`Not ready yet: ${open.map(o=>o.text).join('; ')}.`;$('a',openList)?.focus();
  });
  reject?.addEventListener('click',()=>{
    if(overall.value.trim())return act('reject');
    state.textContent='Rejecting the ticket needs an overall note saying why.';overall.focus();
  });
  reconcile();show();
})();
