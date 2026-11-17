/* Inline tasks share the application stage. No overlay, popup window or focus trap. */
(function(G){
  'use strict';
  const $=id=>document.getElementById(id),host=document.createElement('section');
  host.id='aiWorkbench';host.className='hidden';host.setAttribute('aria-label',G.L('AI 复核工作区','AI review workspace'));
  $('app').appendChild(host);
  let trigger=null;
  function close(){
    G.dispatchEvent(new CustomEvent('gelfigure-ai-task-close',{detail:null}));
    host.classList.add('hidden');host.querySelectorAll('.ai-task').forEach(e=>e.classList.add('hidden'));
    document.body.classList.remove('ai-active');
    G.Editor.resize();
    // Commits while the stage was hidden measured zero bounds; refit after revealing it.
    if(G.App.S)G.UI.updatePreview();
    if(trigger?.isConnected)trigger.focus();
  }
  function show(panel,focus){
    trigger=document.activeElement;
    G.dispatchEvent(new CustomEvent('gelfigure-ai-task-close',{detail:panel.id}));
    host.querySelectorAll('.ai-task').forEach(e=>e.classList.toggle('hidden',e!==panel));
    host.classList.remove('hidden');panel.classList.remove('hidden');document.body.classList.add('ai-active');
    requestAnimationFrame(()=>{if(!host.classList.contains('hidden'))focus?.focus();});
  }
  host.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopPropagation();close();}
    // Keep application editing shortcuts out of draft fields.
    if(/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName))e.stopPropagation();
  });
  G.addEventListener('keydown',e=>{
    const settings=document.getElementById('aiSettingsPanel');
    if(e.key==='Escape'&&!e.isComposing&&!host.classList.contains('hidden')&&(!settings||settings.classList.contains('hidden'))){e.preventDefault();e.stopImmediatePropagation();close();}
  },true);
  G.AIWorkspace={host,show,close};
})(window);
