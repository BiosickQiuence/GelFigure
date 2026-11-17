/* Optional GitHub feedback/Star links, with no payment or feedback submission service. */
(function(G){
  'use strict';
  const $=id=>document.getElementById(id),L=G.L;
  const links=G.GelFigureSupport;
  const desktop=document.createElement('aside');desktop.id='exportThanks';desktop.className='export-thanks hidden';desktop.setAttribute('role','status');document.body.appendChild(desktop);
  const mobile=document.createElement('div');mobile.id='exportThanksMobile';mobile.className='export-thanks-mobile hidden';document.querySelector('#resultSheet .rs-done').before(mobile);
  const hub=document.createElement('div');hub.id='communityDlg';hub.className='dlg hidden';document.body.appendChild(hub);let opener=null;
  function action(kind,label){
    const a=document.createElement('a');a.href=links[kind];a.target='_blank';a.rel='noopener noreferrer';a.dataset.support=kind;a.className='btn sm';a.textContent=label;
    a.onclick=e=>{if(!hub.classList.contains('hidden'))closeHub();if(kind==='feedback'){e.preventDefault();G.Feedback.open();}};return a;
  }
  function closeHub(){hub.classList.add('hidden');const target=opener?.isConnected&&opener.getClientRects().length?opener:$(G.UI.isPhone()?'btnMore':'btnCommunity');target?.focus();}
  function openHub(button){
    G.UI.flushPending();opener=button||document.activeElement;
    hub.innerHTML=`<div class="dlg-body community-body" role="dialog" aria-modal="true" aria-labelledby="communityTitle"><button class="dlg-x" id="communityClose" aria-label="${L('关闭','Close')}">×</button><h3 id="communityTitle">${L('GitHub 反馈与 Star','GitHub feedback and Star')}</h3><p>${L('反馈会打开本项目的 GitHub Issues，需要 GitHub 账号。请勿公开密钥或保密胶图。','Feedback opens this project’s GitHub Issues and requires a GitHub account. Do not post API keys or confidential gel images.')}</p><div class="community-choices" id="communityChoices"></div></div>`;
    for(const [kind,title,description] of [
      ['feedback',L('在 GitHub 反馈问题','Report an issue on GitHub'),L('打开 BiosickQiuence/GelFigure 的问题提交页。','Open the issue composer for BiosickQiuence/GelFigure.')],
      ['star',L('在 GitHub 点 Star','Star on GitHub'),L('打开本项目仓库，可自愿点 Star。','Open this repository; starring is optional.')]
    ]){const a=action(kind,title);a.className='community-choice';a.replaceChildren();const strong=document.createElement('strong'),detail=document.createElement('span');strong.textContent=title;detail.textContent=description;a.append(strong,detail);$('communityChoices').appendChild(a);}
    $('communityClose').onclick=closeHub;hub.classList.remove('hidden');$('communityClose').focus();
  }
  function render(host,closable){
    host.replaceChildren();const title=document.createElement('strong');title.textContent=L('欢迎反馈使用问题和建议','Feedback and suggestions are welcome');host.appendChild(title);
    const text=document.createElement('p');text.textContent=L('链接会打开本项目的 GitHub 页面；不会自动上传图像或项目。','Links open this project on GitHub; images and projects are not uploaded automatically.');host.appendChild(text);
    const actions=document.createElement('div');actions.className='support-actions';actions.append(action('feedback',L('GitHub 反馈','GitHub feedback')),action('star','GitHub Star'));host.appendChild(actions);
    if(closable){const close=document.createElement('button');close.type='button';close.className='support-close';close.textContent='×';close.setAttribute('aria-label',L('关闭此提示','Dismiss this reminder'));close.onclick=()=>desktop.classList.add('hidden');host.appendChild(close);}
  }
  function show(){if(!G.App.S)return;if(!$('resultSheet').classList.contains('hidden')){render(mobile,false);mobile.classList.remove('hidden');}else{render(desktop,true);desktop.classList.remove('hidden');}}
  $('btnCommunity').onclick=()=>openHub($('btnCommunity'));
  hub.addEventListener('click',e=>{if(e.target===hub)closeHub();});
  hub.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeHub();}
    if(e.key==='Tab'){const items=[...hub.querySelectorAll('button,a[href]')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  G.addEventListener('gelfigure-figure-exported',show);
  new MutationObserver(()=>{if($('resultSheet').classList.contains('hidden'))mobile.classList.add('hidden');}).observe($('resultSheet'),{attributes:true,attributeFilter:['class']});
  G.I18N.onChange(()=>{$('btnCommunity').setAttribute('aria-label',L('GitHub 反馈与 Star','GitHub feedback and Star'));if(!hub.classList.contains('hidden'))openHub(opener);if(!desktop.classList.contains('hidden'))render(desktop,true);if(!mobile.classList.contains('hidden'))render(mobile,false);});
  G.ExportSupport={show,links,openHub};
})(window);
