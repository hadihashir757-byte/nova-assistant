/* NOVA UNO — a self-contained UNO game vs NOVA, with a cinematic intro.
   Exposes window.startUno(). No external libraries. */
(function(){
  "use strict";

  // ---------- Pure game logic ----------
  const COLORS = ["red","yellow","green","blue"];
  const HEX = { red:"#e23b3b", yellow:"#f1c40f", green:"#2ecc71", blue:"#3b7de2" };


  function buildDeck(){
    const d=[];
    for(const c of COLORS){
      d.push({c,v:"0"});
      for(let n=1;n<=9;n++){ d.push({c,v:""+n}); d.push({c,v:""+n}); }
      for(const s of ["skip","reverse","draw2"]){ d.push({c,v:s}); d.push({c,v:s}); }
    }
    for(let i=0;i<4;i++){ d.push({c:"wild",v:"wild"}); d.push({c:"wild",v:"wild4"}); }
    return d;
  }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  // Can `card` be played on top `top` given the active `color`?
  function canPlay(card, top, color){
    if(card.c==="wild") return true;
    if(card.c===color) return true;
    if(card.v===top.v && card.c===top.c) return true; // same color+value (redundant with above)
    if(card.v===top.v) return true; // same symbol/number
    return false;
  }
  function hasAnyPlay(hand, top, color){ return hand.some(c=>canPlay(c,top,color)); }

  // NOVA picks a card index to play (or -1 to draw). Simple heuristic.
  function aiChoose(hand, top, color){
    const plays = hand.map((c,i)=>({c,i})).filter(o=>canPlay(o.c,top,color));
    if(!plays.length) return -1;
    const rank = o => {
      const v=o.c.v;
      if(v==="wild4") return 5;
      if(v==="draw2") return 4;
      if(v==="skip"||v==="reverse") return 3;
      if(v==="wild") return 1; // save wilds-ish but still ok
      return 2; // numbers
    };
    plays.sort((a,b)=>rank(b)-rank(a));
    return plays[0].i;
  }
  // NOVA picks a color when playing a wild: most common color in hand.
  function aiColor(hand){
    const count={red:0,yellow:0,green:0,blue:0};
    hand.forEach(c=>{ if(c.c!=="wild") count[c.c]++; });
    let best="red",bv=-1;
    for(const k of COLORS){ if(count[k]>bv){ bv=count[k]; best=k; } }
    return best;
  }

  // expose pure fns for testing
  if (typeof module !== "undefined" && module.exports){
    module.exports = { buildDeck, canPlay, hasAnyPlay, aiChoose, aiColor, COLORS };
  }

  // ---------- Styles ----------
  function injectCSS(){
    if(document.getElementById("uno-css")) return;
    const css = `
    #uno{position:fixed;inset:0;z-index:9999;font-family:"Segoe UI",system-ui,sans-serif;color:#fff;overflow:hidden;background:#05070f;display:none}
    #uno.show{display:block}
    #uno *{box-sizing:border-box}
    #uno .exit{position:absolute;top:calc(14px + env(safe-area-inset-top));right:16px;z-index:40;width:44px;height:44px;border-radius:50%;border:none;background:rgba(0,0,0,.45);color:#fff;font-size:1.4rem;cursor:pointer;backdrop-filter:blur(4px)}
    #uno .exit:hover{background:rgba(0,0,0,.7)}
    /* cinematic */
    #uno .cine{position:absolute;inset:0;z-index:30;background:#000;display:flex;align-items:center;justify-content:center}
    #uno .dealGlow{position:absolute;z-index:33;left:50%;top:50%;width:70vmin;height:70vmin;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(94,240,208,.22),rgba(139,123,255,.12) 40%,transparent 70%);filter:blur(12px)}
    #uno .hand{position:absolute;z-index:34;top:50%;width:min(52vh,46vw);transform:translateY(-46%);filter:drop-shadow(0 18px 30px rgba(0,0,0,.55));transition:opacity .45s ease}
    #uno .hand svg{width:100%;height:auto;display:block}
    #uno .hand.l{left:-55vw;transform:translateY(-46%) rotate(-8deg)}
    #uno .hand.r{right:-55vw;transform:translateY(-46%) rotate(8deg) scaleX(-1)}
    #uno .cine.revealing .hand{opacity:0}
    #uno .cine.clap .hand.l{animation:handL 1.1s cubic-bezier(.2,.7,.2,1) forwards}
    #uno .cine.clap .hand.r{animation:handR 1.1s cubic-bezier(.2,.7,.2,1) forwards}
    @keyframes handL{to{left:-6vw}}
    @keyframes handR{to{right:-6vw}}
    #uno .lid{position:absolute;left:0;right:0;height:52%;background:#000;z-index:32;transition:transform 1.1s cubic-bezier(.7,0,.3,1)}
    #uno .lid.top{top:0}
    #uno .lid.bot{bottom:0}
    #uno.eyesopen .lid.top{transform:translateY(-100%)}
    #uno.eyesopen .lid.bot{transform:translateY(100%)}
    #uno .cue{position:absolute;z-index:35;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-size:1.5rem;letter-spacing:.3em;text-transform:uppercase;opacity:0;transition:opacity .6s;color:#5ef0d0}
    #uno .cue.show{opacity:1}
    /* table */
    #uno .scene{position:absolute;inset:0;z-index:10;background:radial-gradient(ellipse at 50% 8%,#1a2d4a 0%,#0c1b2e 45%,#05070f 100%);perspective:1100px;display:flex;flex-direction:column;overflow:hidden;transform-origin:50% 42%;animation:sitDown 1.25s cubic-bezier(.2,.75,.2,1) both}
    @keyframes sitDown{
      0%{transform:translateY(-16%) scale(1.22) rotateX(10deg);filter:blur(5px);opacity:0}
      35%{opacity:1;filter:blur(1px)}
      70%{transform:translateY(2%) scale(.99) rotateX(0deg);filter:blur(0)}
      100%{transform:translateY(0) scale(1) rotateX(0deg);filter:blur(0)}
    }
    #uno .scene::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 45%,rgba(0,0,0,.55) 100%);z-index:20}
    #uno .felt{position:absolute;left:50%;top:50%;width:170vw;height:135vh;transform:translate(-50%,-46%) rotateX(60deg);background:radial-gradient(ellipse at 50% 38%,#2b9a63 0%,#1f7a4d 32%,#14633d 60%,#0b3f27 100%);border-radius:50%;box-shadow:inset 0 0 160px rgba(0,0,0,.6),0 -30px 90px rgba(0,0,0,.5)}
    #uno .felt::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(ellipse at 50% 20%,rgba(255,255,255,.14),transparent 45%)}
    #uno .felt::after{content:"";position:absolute;inset:6%;border-radius:50%;border:2px solid rgba(255,255,255,.08)}
    #uno .novaSeat{position:relative;z-index:12;text-align:center;padding:calc(24px + env(safe-area-inset-top)) 0 4px}
    #uno .novaBloom{position:absolute;left:50%;top:calc(24px + env(safe-area-inset-top));width:300px;height:300px;transform:translate(-50%,-30%);background:radial-gradient(circle,rgba(94,240,208,.35),rgba(139,123,255,.18) 35%,transparent 68%);filter:blur(10px);pointer-events:none}
    #uno .novaOrb{position:relative;width:118px;height:118px;margin:0 auto 10px}
    #uno .novaOrb .core{position:absolute;inset:24px;border-radius:50%;background:radial-gradient(circle at 36% 30%,#f2fffb 0%,#9af7e4 18%,#5ef0d0 40%,#8b7bff 78%,#3b2b7a 100%);box-shadow:0 0 40px rgba(94,240,208,.7),0 0 90px rgba(139,123,255,.5),inset 0 -8px 22px rgba(43,29,107,.6);animation:orbPulse 3.4s ease-in-out infinite}
    #uno .novaOrb .gloss{position:absolute;inset:24px;border-radius:50%;background:radial-gradient(circle at 36% 26%,rgba(255,255,255,.85),rgba(255,255,255,0) 42%);mix-blend-mode:screen}
    #uno .novaOrb .ring{position:absolute;border-radius:50%;border:2px solid transparent}
    #uno .novaOrb .ring.a{inset:0;border-top-color:#5ef0d0;border-left-color:#8b7bff;animation:spin 5s linear infinite}
    #uno .novaOrb .ring.b{inset:10px;border-top-color:#8b7bff;border-right-color:#5ef0d0;opacity:.75;animation:spin 7.5s linear infinite reverse}
    #uno .novaOrb .ring.c{inset:3px;border:1px dashed rgba(94,240,208,.35);animation:spin 16s linear infinite}
    #uno .thinking .novaOrb .core{animation:orbPulse 1s ease-in-out infinite}
    #uno .thinking .novaOrb .ring.a{animation-duration:1.4s}
    @keyframes orbPulse{50%{transform:scale(1.07);box-shadow:0 0 60px rgba(94,240,208,.9),0 0 130px rgba(139,123,255,.65),inset 0 -8px 22px rgba(43,29,107,.6)}}
    #uno .novaName{font-size:.82rem;letter-spacing:.3em;color:#d7fff5;text-transform:uppercase;text-shadow:0 0 10px rgba(94,240,208,.5)}
    #uno .oppHand{display:flex;justify-content:center;gap:-14px;margin-top:6px;min-height:62px}
    #uno .oppHand .mini{width:38px;height:56px;margin-left:-14px;border-radius:6px;background:linear-gradient(135deg,#2b1d6b,#8b7bff);border:2px solid #0b1026;box-shadow:0 2px 6px rgba(0,0,0,.4)}
    #uno .center{position:relative;z-index:12;flex:1;display:flex;align-items:center;justify-content:center;gap:22px}
    #uno .pile{display:flex;flex-direction:column;align-items:center;gap:6px}
    #uno .pile small{font-size:.65rem;letter-spacing:.15em;color:#bfe9df;opacity:.8;text-transform:uppercase}
    #uno .status{position:absolute;top:50%;left:0;right:0;transform:translateY(-120px);text-align:center;font-size:1rem;color:#eafff8;text-shadow:0 2px 8px rgba(0,0,0,.6);pointer-events:none;padding:0 16px}
    #uno .colorchip{position:absolute;top:50%;left:50%;transform:translate(60px,-70px);width:20px;height:20px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px rgba(0,0,0,.5)}
    #uno .myArea{position:relative;z-index:14;padding:8px 6px calc(10px + env(safe-area-inset-bottom))}
    #uno .myLabel{text-align:center;font-size:.7rem;letter-spacing:.2em;color:#cfe;opacity:.8;text-transform:uppercase;margin-bottom:4px}
    #uno .myHand{display:flex;justify-content:center;flex-wrap:nowrap;overflow-x:auto;gap:6px;padding:6px 8px}
    #uno .myHand::-webkit-scrollbar{height:6px}
    #uno .myHand::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:3px}
    #uno .card{flex:0 0 auto;width:64px;height:94px;border-radius:9px;position:relative;cursor:pointer;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.45);transition:transform .15s;user-select:none}
    #uno .card:not(.disabled):hover{transform:translateY(-10px)}
    #uno .card.disabled{opacity:.45;cursor:default}
    #uno .card .big{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.9rem;font-weight:800;color:#fff;text-shadow:0 2px 3px rgba(0,0,0,.35)}
    #uno .card .cnr{position:absolute;font-size:.8rem;font-weight:800;color:#fff}
    #uno .card .cnr.tl{top:4px;left:6px}
    #uno .card .cnr.br{bottom:4px;right:6px;transform:rotate(180deg)}
    #uno .card .oval{position:absolute;inset:10px;background:rgba(255,255,255,.22);border-radius:50%/40%}
    #uno .card::after{content:"";position:absolute;inset:0;border-radius:6px;background:linear-gradient(135deg,rgba(255,255,255,.4),rgba(255,255,255,0) 42%,rgba(0,0,0,.18));pointer-events:none}
    #uno .center .card{box-shadow:0 10px 24px rgba(0,0,0,.55)}
    #uno .card.back{background:linear-gradient(135deg,#2b1d6b,#8b7bff)}
    #uno .card.wildface{background:conic-gradient(#e23b3b 0 25%,#f1c40f 0 50%,#2ecc71 0 75%,#3b7de2 0)}
    #uno .draw{width:64px;height:94px}
    #uno .btn{border:none;border-radius:10px;padding:10px 16px;font-size:.95rem;font-weight:700;cursor:pointer;color:#05070f;background:linear-gradient(135deg,#5ef0d0,#8b7bff)}
    /* overlays (setup / color / result) */
    #uno .modal{position:absolute;inset:0;z-index:25;background:rgba(5,7,15,.82);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px}
    #uno .panel{max-width:360px;width:100%;text-align:center;background:rgba(20,28,52,.8);border:1px solid rgba(120,160,255,.25);border-radius:18px;padding:26px 22px}
    #uno .panel h2{font-size:1.3rem;margin:0 0 6px}
    #uno .panel p{color:#aeb9d8;font-size:.9rem;margin:0 0 16px}
    #uno .opts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    #uno .opts .btn{min-width:60px}
    #uno .colors{display:flex;gap:14px;justify-content:center;margin-top:6px}
    #uno .swatch{width:56px;height:56px;border-radius:12px;border:3px solid #fff;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.4)}
    #uno .big-emoji{font-size:3rem;margin-bottom:8px}
    `;
    const st=document.createElement("style"); st.id="uno-css"; st.textContent=css; document.head.appendChild(st);
  }

  // ---------- Rendering helpers ----------
  const label = v => v==="draw2"?"+2":v==="wild4"?"+4":v==="skip"?"⊘":v==="reverse"?"⇄":v==="wild"?"★":v;
  function cardFace(card){
    const d=document.createElement("div"); d.className="card";
    if(card.c==="wild"){ d.classList.add("wildface");
      d.innerHTML=`<div class="big">${card.v==="wild4"?"+4":"★"}</div><div class="cnr tl">${card.v==="wild4"?"+4":"★"}</div><div class="cnr br">${card.v==="wild4"?"+4":"★"}</div>`;
    } else {
      d.style.background=HEX[card.c];
      d.innerHTML=`<div class="oval"></div><div class="big">${label(card.v)}</div><div class="cnr tl">${label(card.v)}</div><div class="cnr br">${label(card.v)}</div>`;
    }
    return d;
  }

  // ---------- Game instance ----------
  function startUno(){
    injectCSS();
    // remove any previous
    const old=document.getElementById("uno"); if(old) old.remove();

    const root=document.createElement("div"); root.id="uno"; root.classList.add("show"); document.body.appendChild(root);
    // pause NOVA voice/mic if present
    try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){}

    const state={ deck:[], discard:[], me:[], nova:[], color:null, turn:"me", over:false, handSize:7 };

    // exit button
    const exit=document.createElement("button"); exit.className="exit"; exit.textContent="✕"; exit.title="Leave the match";
    exit.onclick=()=>endUno(root); root.appendChild(exit);

    // --- cinematic intro ---
    const cine=document.createElement("div"); cine.className="cine";
    cine.innerHTML=`<div class="dealGlow"></div>
      <div class="lid top"></div><div class="lid bot"></div>
      <div class="cue">Open your eyes…</div>`;
    root.appendChild(cine);
    // allow tap to skip
    let skipped=false; const skip=()=>{ if(!skipped){ skipped=true; reveal(); } };
    cine.addEventListener("click", skip);
    let revealed=false;

    setTimeout(()=>cine.classList.add("clap"), 150);
    setTimeout(()=>cine.querySelector(".cue").classList.add("show"), 1150);
    setTimeout(()=>{ if(!skipped) reveal(); }, 2200);

    function reveal(){
      if(revealed) return; revealed=true;
      cine.classList.add("revealing");
      cine.querySelector(".cue").classList.remove("show");
      root.classList.add("eyesopen");           // eyelids open
      setTimeout(()=>{ cine.style.display="none"; buildScene(); askHandSize(); }, 1150);
    }

    // --- scene ---
    let elNovaHand, elDiscard, elMyHand, elStatus, elColor;
    function buildScene(){
      const scene=document.createElement("div"); scene.className="scene";
      scene.innerHTML=`
        <div class="felt"></div>
        <div class="novaSeat"><div class="novaBloom"></div><div class="novaOrb"><span class="ring a"></span><span class="ring b"></span><span class="ring c"></span><span class="core"></span><span class="gloss"></span></div><div class="novaName">NOVA</div>
          <div class="oppHand" id="uno-opp"></div></div>
        <div class="center">
          <div class="pile"><div class="draw card back" id="uno-draw"></div><small>Draw</small></div>
          <div class="pile"><div id="uno-discard"></div><small>Discard</small></div>
          <div class="colorchip" id="uno-color" style="display:none"></div>
          <div class="status" id="uno-status"></div>
        </div>
        <div class="myArea"><div class="myLabel">Your cards</div><div class="myHand" id="uno-myhand"></div></div>`;
      root.insertBefore(scene, exit);
      elNovaHand=scene.querySelector("#uno-opp");
      elDiscard=scene.querySelector("#uno-discard");
      elMyHand=scene.querySelector("#uno-myhand");
      elStatus=scene.querySelector("#uno-status");
      elColor=scene.querySelector("#uno-color");
      scene.querySelector("#uno-draw").onclick=onDrawClick;
    }

    function askHandSize(){
      const modal=document.createElement("div"); modal.className="modal"; modal.id="uno-setup";
      modal.innerHTML=`<div class="panel"><h2>Deal the cards</h2><p>How many cards do you each want to start with?</p>
        <div class="opts">
          <button class="btn" data-n="5">5</button>
          <button class="btn" data-n="7">7</button>
          <button class="btn" data-n="10">10</button>
        </div></div>`;
      root.appendChild(modal);
      modal.querySelectorAll("button").forEach(b=>b.onclick=()=>{ state.handSize=+b.dataset.n; modal.remove(); deal(); });
    }

    function freshDeck(){ state.deck=shuffle(buildDeck()); }
    function drawN(who,n){ for(let i=0;i<n;i++){ if(!state.deck.length) reclaim(); if(!state.deck.length) break; state[who].push(state.deck.pop()); } }
    function reclaim(){ // reshuffle discard (except top) back into deck
      if(state.discard.length<=1) return;
      const top=state.discard.pop(); state.deck=shuffle(state.discard.map(c=> c.c==="wild"?{c:"wild",v:c.v}:c)); state.discard=[top];
    }

    function deal(){
      freshDeck(); state.me=[]; state.nova=[]; state.discard=[];
      drawN("me",state.handSize); drawN("nova",state.handSize);
      // starting discard: draw until a non-wild number/action (keep simple: any non-wild)
      let first;
      do{ first=state.deck.pop(); if(first.c==="wild"){ state.deck.unshift(first); shuffle(state.deck);} } while(first.c==="wild");
      state.discard.push(first); state.color=first.c; state.turn="me"; state.over=false; state.drew=false;
      render(); setStatus("Your turn — match the color or number.");
      // if first card is an action, apply mild effect to starter (skip NOVA-start complexity; player starts)
    }

    function setStatus(t){ if(elStatus) elStatus.textContent=t; }

    function render(){
      // nova hand (backs)
      elNovaHand.innerHTML=""; state.nova.forEach(()=>{ const m=document.createElement("div"); m.className="mini"; elNovaHand.appendChild(m); });
      // discard
      elDiscard.innerHTML=""; const top=state.discard[state.discard.length-1]; elDiscard.appendChild(cardFace(top));
      // active color chip
      if(top.c==="wild"){ elColor.style.display=""; elColor.style.background=HEX[state.color]||"#fff"; }
      else { elColor.style.display="none"; }
      // my hand
      elMyHand.innerHTML="";
      state.me.forEach((card,idx)=>{
        const el=cardFace(card);
        const playable = state.turn==="me" && !state.over && canPlay(card,top,state.color);
        if(!playable) el.classList.add("disabled");
        else el.onclick=()=>playCard(idx);
        elMyHand.appendChild(el);
      });
    }

    function topCard(){ return state.discard[state.discard.length-1]; }

    function playCard(idx){
      if(state.turn!=="me"||state.over) return;
      const card=state.me[idx]; if(!canPlay(card,topCard(),state.color)) return;
      state.me.splice(idx,1); state.drew=false;
      state.discard.push(card);
      if(card.c==="wild"){ render(); chooseColor(col=>{ state.color=col; afterPlay(card,"me"); }); }
      else { state.color=card.c; afterPlay(card,"me"); }
    }

    function chooseColor(cb){
      const modal=document.createElement("div"); modal.className="modal";
      modal.innerHTML=`<div class="panel"><h2>Pick a color</h2><div class="colors">
        ${COLORS.map(c=>`<div class="swatch" data-c="${c}" style="background:${HEX[c]}"></div>`).join("")}
      </div></div>`;
      root.appendChild(modal);
      modal.querySelectorAll(".swatch").forEach(s=>s.onclick=()=>{ modal.remove(); cb(s.dataset.c); });
    }

    // Apply a played card's effect, check win, pass turn.
    function afterPlay(card, who){
      render();
      if(state[who].length===0){ return finish(who); }
      const opp = who==="me" ? "nova" : "me";
      let skipOpp=false;
      if(card.v==="draw2"){ drawN(opp,2); skipOpp=true; }
      else if(card.v==="wild4"){ drawN(opp,4); skipOpp=true; }
      else if(card.v==="skip"||card.v==="reverse"){ skipOpp=true; } // reverse acts as skip in 2P
      render();
      if(skipOpp){ // same player goes again
        if(who==="me"){ state.turn="me"; setStatus(effMsg(card,true)); render(); }
        else { setStatus(effMsg(card,false)); setTimeout(novaTurn, 900); }
      } else {
        if(who==="me"){ state.turn="nova"; setStatus("NOVA's turn…"); root.classList.add("thinking"); render(); setTimeout(novaTurn, 1100); }
        else { state.turn="me"; setStatus("Your turn."); render(); }
      }
    }

    function effMsg(card, mine){
      const n = mine?"NOVA":"You";
      if(card.v==="draw2") return `${n} draw 2 and miss a turn.`;
      if(card.v==="wild4") return `${n} draw 4 and miss a turn.`;
      if(card.v==="skip") return `${n} skipped!`;
      if(card.v==="reverse") return `Reverse — ${n.toLowerCase()==="you"?"you miss":"NOVA misses"} a turn.`;
      return "";
    }

    function onDrawClick(){
      if(state.turn!=="me"||state.over) return;
      if(state.drew){ state.drew=false; state.turn="nova"; setStatus("You passed. NOVA's turn…"); render(); setTimeout(novaTurn,900); return; }
      if(hasAnyPlay(state.me, topCard(), state.color)){ setStatus("You have a playable card — tap it to play."); return; }
      drawN("me",1); render();
      const drawn=state.me[state.me.length-1];
      if(canPlay(drawn, topCard(), state.color)){ state.drew=true; setStatus("You drew a playable card — tap it, or tap the draw pile to pass."); render(); }
      else { setStatus("No play — passing to NOVA…"); state.turn="nova"; render(); setTimeout(novaTurn,900); }
    }

    function novaTurn(){
      if(state.over) return;
      root.classList.remove("thinking");
      let idx=aiChoose(state.nova, topCard(), state.color);
      if(idx<0){
        drawN("nova",1); render();
        idx=aiChoose(state.nova, topCard(), state.color); // can it play the drawn card?
        if(idx<0){ state.turn="me"; setStatus("NOVA drew and passed. Your turn."); render(); return; }
      }
      const card=state.nova[idx]; state.nova.splice(idx,1); state.discard.push(card);
      if(card.c==="wild"){ state.color=aiColor(state.nova); }
      else state.color=card.c;
      setStatus(`NOVA played ${describe(card)}.`);
      afterPlay(card,"nova");
    }

    function describe(card){
      if(card.v==="wild") return "a Wild ("+state.color+")";
      if(card.v==="wild4") return "a Wild +4 ("+state.color+")";
      if(card.v==="draw2") return card.c+" +2";
      if(card.v==="skip") return card.c+" Skip";
      if(card.v==="reverse") return card.c+" Reverse";
      return card.c+" "+card.v;
    }

    function finish(who){
      state.over=true; render();
      const win = who==="me";
      const modal=document.createElement("div"); modal.className="modal";
      modal.innerHTML=`<div class="panel"><div class="big-emoji">${win?"🎉":"🤖"}</div>
        <h2>${win?"You win!":"NOVA wins!"}</h2>
        <p>${win?"You cleared your hand first. Nicely played.":"NOVA cleared its hand first. Rematch?"}</p>
        <div class="opts"><button class="btn" id="uno-again">Play again</button>
        <button class="btn" id="uno-quit" style="background:rgba(255,255,255,.15);color:#fff">Leave</button></div></div>`;
      root.appendChild(modal);
      modal.querySelector("#uno-again").onclick=()=>{ modal.remove(); askHandSize(); };
      modal.querySelector("#uno-quit").onclick=()=>endUno(root);
    }
  }

  function endUno(root){
    root.style.transition="opacity .5s"; root.style.opacity="0";
    setTimeout(()=>{ root.remove(); }, 520);
  }

  window.startUno = startUno;
})();
