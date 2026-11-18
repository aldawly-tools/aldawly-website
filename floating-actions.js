/* One compact services menu shared by all storefront pages. */
(function(){
 function init(){
  if(document.getElementById('dawlyQuickMenu'))return;
  var contact=document.getElementById('floatingContactWidget');
  var assistant=document.getElementById('dawlyBotLauncher');
  var menu=document.createElement('div');menu.id='dawlyQuickMenu';
  menu.innerHTML='<button id="dawlyQuickMenuToggle" type="button" aria-label="فتح قائمة الخدمات" aria-expanded="false"><svg class="quick-menu-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="quick-menu-close" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div id="dawlyQuickMenuPanel" hidden><div class="dawly-quick-menu-heading">خدمات الدولي السريعة</div><div class="dawly-quick-menu-slot" id="dawlyQuickAssistant"></div><div class="dawly-quick-menu-slot" id="dawlyQuickContact"></div></div>';
  document.body.appendChild(menu);
  var panel=menu.querySelector('#dawlyQuickMenuPanel'),toggle=menu.querySelector('#dawlyQuickMenuToggle');
  function place(){
   assistant=document.getElementById('dawlyBotLauncher');
   contact=document.getElementById('floatingContactWidget');
   var cSlot=menu.querySelector('#dawlyQuickContact');
   if(contact&&contact.parentNode!==cSlot)cSlot.appendChild(contact);
   var aSlot=menu.querySelector('#dawlyQuickAssistant');aSlot.hidden=true;cSlot.hidden=!contact;
   if(!assistant&&!contact)menu.hidden=true;
  }
  function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
  toggle.addEventListener('click',function(){var open=panel.hidden;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));});
  menu.addEventListener('click',function(e){
   if(e.target.closest('.floating-contact-toggle')){panel.hidden=false;toggle.setAttribute('aria-expanded','true');}
  });
  document.addEventListener('click',function(e){if(!menu.contains(e.target)&&!e.target.closest('#dawlyBotPanel'))close();});
  var observer=new MutationObserver(place);observer.observe(document.body,{childList:true,subtree:true});
  place();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


/* Temporarily hide floating launchers during active page scrolling, then restore them. */
(function(){
 function init(){
  if(window.__dawlyScrollHideReady)return;
  window.__dawlyScrollHideReady=true;
  var timer=null;
  function hideDuringScroll(){
   var menuPanel=document.getElementById('dawlyQuickMenuPanel');
   var contactPanel=document.getElementById('floatingContactPanel');
   var botPanel=document.getElementById('dawlyBotPanel');
   var cartDrawer=document.querySelector('.cart-drawer.open');
   /* Keep controls available when one of their panels is actively in use. */
   if((menuPanel&&!menuPanel.hidden)||(contactPanel&&!contactPanel.hidden)||(botPanel&&!botPanel.hidden)||cartDrawer){
    document.body.classList.remove('dawly-is-scrolling');
    return;
   }
   document.body.classList.add('dawly-is-scrolling');
   if(timer)window.clearTimeout(timer);
   timer=window.setTimeout(function(){
    document.body.classList.remove('dawly-is-scrolling');
    timer=null;
   },220);
  }
  window.addEventListener('scroll',hideDuringScroll,{passive:true});
  window.addEventListener('touchmove',hideDuringScroll,{passive:true});
  window.addEventListener('pointerdown',function(){document.body.classList.remove('dawly-is-scrolling');},{passive:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
