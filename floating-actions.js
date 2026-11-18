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
   var aSlot=menu.querySelector('#dawlyQuickAssistant'),cSlot=menu.querySelector('#dawlyQuickContact');
   if(assistant&&assistant.parentNode!==aSlot)aSlot.appendChild(assistant);
   if(contact&&contact.parentNode!==cSlot)cSlot.appendChild(contact);
   aSlot.hidden=!assistant;cSlot.hidden=!contact;
   if(!assistant&&!contact)menu.hidden=true;
  }
  function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
  toggle.addEventListener('click',function(){var open=panel.hidden;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));});
  menu.addEventListener('click',function(e){
   if(e.target.closest('#dawlyBotLauncher'))close();
   if(e.target.closest('.floating-contact-toggle')){panel.hidden=false;toggle.setAttribute('aria-expanded','true');}
  });
  document.addEventListener('click',function(e){if(!menu.contains(e.target)&&!e.target.closest('#dawlyBotPanel'))close();});
  var observer=new MutationObserver(place);observer.observe(document.body,{childList:true,subtree:true});
  place();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
