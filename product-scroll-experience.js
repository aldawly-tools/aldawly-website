(function(){
  var grid=document.getElementById('productGrid');
  if(!grid)return;
  var frame=0, cards=[];
  function collect(){
    cards=Array.from(grid.querySelectorAll('.catalog-card'));
    update();
  }
  function update(){
    frame=0;
    var vh=window.innerHeight||700, center=vh*.48;
    cards.forEach(function(card){
      if(!card.isConnected)return;
      var visual=card.querySelector('.product-visual');
      var info=card.querySelector('.product-info');
      var img=card.querySelector('.product-visual img');
      var rect=card.getBoundingClientRect();
      var span=Math.max(vh*.72,card.offsetHeight-vh*.2);
      var p=Math.max(0,Math.min(1,(center-rect.top)/span));
      var eased=p*p*(3-2*p);
      card.style.setProperty('--image-y',((1-eased)*26).toFixed(1)+'px');
      card.style.setProperty('--image-scale',(0.94+eased*.06).toFixed(4));
      card.style.setProperty('--image-opacity',(0.78+eased*.22).toFixed(3));
      card.style.setProperty('--copy-y',((1-eased)*18).toFixed(1)+'px');
      card.style.setProperty('--copy-opacity',(0.82+eased*.18).toFixed(3));
      card.classList.toggle('is-scroll-active',rect.top<vh*.72&&rect.bottom>vh*.25);
    });
  }
  function schedule(){if(frame)return;frame=requestAnimationFrame(update);}
  new MutationObserver(collect).observe(grid,{childList:true});
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  collect();
})();