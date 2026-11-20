(function () {
  "use strict";
  var input=document.getElementById("searchInput");
  var form=document.getElementById("searchForm");
  if(!input||!form||form.querySelector(".dawly-voice-search"))return;
  var SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  var button=document.createElement("button");
  button.type="button";
  button.className="dawly-voice-search";
  button.setAttribute("aria-label","البحث بالصوت");
  button.setAttribute("title","البحث بالصوت");
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4m-4 0h8"/></svg>';
  button.style.cssText="display:inline-flex;align-items:center;justify-content:center;flex:0 0 42px;width:42px;min-width:42px;height:42px;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;border-radius:10px";
  var svg=button.querySelector("svg");
  svg.style.cssText="width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round";
  var recognition=null,listening=false;
  function state(active,message){
    listening=active;
    button.style.color=active?"#d71920":"";
    button.style.background=active?"rgba(215,25,32,.10)":"transparent";
    button.setAttribute("aria-label",active?"إيقاف البحث الصوتي":"البحث بالصوت");
    button.setAttribute("title",message|| (active?"استمع الآن… اضغط للإيقاف":"البحث بالصوت"));
    button.setAttribute("aria-pressed",active?"true":"false");
  }
  function unsupported(){
    button.disabled=true;
    button.style.opacity=".45";
    button.title="البحث الصوتي غير مدعوم في هذا المتصفح. جرّب Chrome.";
    button.setAttribute("aria-label",button.title);
  }
  if(!SpeechRecognition){unsupported();}
  else{
    recognition=new SpeechRecognition();
    recognition.lang="ar-EG";
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.maxAlternatives=3;
    var finalText="";
    recognition.onstart=function(){finalText="";state(true,"جاري الاستماع… اضغط لإيقاف التسجيل");};
    function cleanVoiceQuery(value){
      return String(value||"")
        .replace(/(?:من فضلك|لو سمحت|عاوز|عايزة|عايز|عاوزة|محتاج|محتاجة|هاتلي|هات|وريني|ابحث عن|دورلي على|دور على|عايز اشوف|عاوز اشوف)/g," ")
        .replace(/\\s+/g," ").trim();
    }
    function catalogMatchScore(phrase){
      var query=cleanVoiceQuery(phrase).toLocaleLowerCase("ar");
      if(!query)return 0;
      var terms=query.split(/\\s+/).filter(Boolean);
      var catalog=Array.isArray(window.DAWLY_PRODUCTS)?window.DAWLY_PRODUCTS:[];
      if(!catalog.length)return 0;
      var best=0;
      catalog.forEach(function(product){
        var name=String(product&&product.name||"").toLocaleLowerCase("ar")
          .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه");
        var words=name.split(/[^\\p{L}\\p{N}]+/u).filter(Boolean);
        var matched=terms.filter(function(term){
          term=term.replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه");
          return words.some(function(word){return word===term||word.startsWith(term)||term.startsWith(word);});
        }).length;
        best=Math.max(best,matched/terms.length);
      });
      return best;
    }
    recognition.onresult=function(event){
      var interim="";
      for(var i=event.resultIndex;i<event.results.length;i++){
        var result=event.results[i], candidates=[];
        for(var a=0;a<result.length;a++){
          candidates.push({text:result[a].transcript||"",confidence:Number(result[a].confidence)||0,index:a});
        }
        candidates.sort(function(a,b){
          var scoreA=catalogMatchScore(a.text),scoreB=catalogMatchScore(b.text);
          if(scoreA!==scoreB)return scoreB-scoreA;
          return b.confidence-a.confidence;
        });
        var phrase=candidates.length?candidates[0].text:"";
        phrase=cleanVoiceQuery(phrase);
        if(result.isFinal)finalText+=(phrase||"")+" ";
        else interim+=phrase;
      }
      var value=cleanVoiceQuery(finalText+interim).trim();
      if(value){input.value=value;input.dispatchEvent(new Event("input",{bubbles:true}));}
    };
    recognition.onerror=function(event){
      var messages={ "not-allowed":"اسمح للمتصفح باستخدام الميكروفون من إعدادات الموقع.","service-not-allowed":"خدمة الميكروفون غير مسموح بها في المتصفح.","no-speech":"لم أسمع صوتًا. حاول مرة أخرى.","audio-capture":"لم يتم العثور على ميكروفون."};
      state(false,messages[event.error]||"تعذر تشغيل البحث الصوتي. حاول مرة أخرى.");
    };
    recognition.onend=function(){
      var hadText=!!input.value.trim();
      state(false,hadText?"تم تحويل كلامك إلى نص.":"انتهى الاستماع. اضغط على الميكروفون للمحاولة مجددًا.");
      if(hadText&&finalText.trim()){
        if(typeof form.requestSubmit==="function")form.requestSubmit();
        else form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
      }
    };
    button.addEventListener("click",function(){
      if(listening){try{recognition.stop();}catch(e){}return;}
      try{input.focus();recognition.start();}
      catch(e){state(false,"تعذر بدء التسجيل. انتظر لحظة ثم حاول مجددًا.");}
    });
  }
  var submit=form.querySelector('button[type="submit"]');
  if(submit)form.insertBefore(button,submit);else form.appendChild(button);
})();