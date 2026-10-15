<?php
header('X-Robots-Tag: noindex, nofollow', true);
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Admin — Classificação Caterham Esports</title>
<link rel="stylesheet" href="../assets/classificacao.css">
</head>
<body>
<main>
<h1>Admin — Classificação</h1>
<p class="sub">Academy e 420R são eventos iRacing independentes</p>

<div class="admin-grid">
<section class="card">
<h2>Importar resultado</h2>
<form id="importForm">
<label>Token administrativo</label>
<input type="password" name="token" id="tokenImport" required>

<label>Campeonato</label>
<select name="category" required>
  <option value="Academy">Caterham Academy</option>
  <option value="420R">Caterham 420R</option>
</select>

<label>Etapa</label>
<select name="stage" required>
  <option value="1">Etapa 1</option>
  <option value="2">Etapa 2</option>
  <option value="3">Etapa 3</option>
  <option value="4">Etapa 4</option>
  <option value="5">Etapa 5</option>
</select>

<label>eventresult.json da categoria escolhida</label>
<input type="file" name="result_file" accept=".json,application/json" required>

<label>
<input type="checkbox" name="replace" value="1">
Substituir resultado já importado para esta categoria/etapa
</label>
<br><br>
<button class="btn primary">Importar e recalcular</button>
</form>
<pre id="importOut">Nenhuma importação realizada.</pre>
</section>

<section class="card">
<h2>Estado dos campeonatos</h2>
<label>Token administrativo</label>
<input type="password" id="tokenState">
<br><br>
<button class="btn secondary" id="loadState">Carregar</button>
<pre id="stateOut">Informe o token e carregue.</pre>
</section>
</div>

<section class="card">
<h2>Ajustes pós-prova</h2>
<p class="note">
Cada ajuste pertence a uma categoria, etapa e bateria específicas.
Posição oficial move o piloto e desloca os demais. Δ pontos aceita valor negativo.
DQ zera a pontuação e não pode ser descartada.
</p>
<div id="adjustments"></div>
</section>


</main>

<script>
const $=s=>document.querySelector(s);
let adminData=null;

$('#importForm').onsubmit=async e=>{
  e.preventDefault();
  $('#importOut').textContent='Processando...';
  const res=await fetch('../api/import_stage.php',{method:'POST',body:new FormData(e.target)});
  const j=await res.json();
  $('#importOut').textContent=JSON.stringify(j,null,2);
};

$('#loadState').onclick=loadState;

async function loadState(){
  const token=$('#tokenState').value||$('#tokenImport').value;
  if(!token){alert('Informe o token.');return;}

  const res=await fetch('../api/admin_state.php?token='+encodeURIComponent(token),{cache:'no-store'});
  const j=await res.json();

  if(!j.ok){
    $('#stateOut').textContent=JSON.stringify(j,null,2);
    return;
  }

  adminData=j.data;
  const state=adminData.state?.categories||{};
  const a=Object.keys(state.Academy?.stages||{}).join(', ')||'nenhuma';
  const r=Object.keys(state['420R']?.stages||{}).join(', ')||'nenhuma';
  $('#stateOut').textContent=`Academy: etapas ${a}\n420R: etapas ${r}`;

  renderAdjustments(token);
}

function esc(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderAdjustments(token){
  const rows=adminData.rows||[];

  $('#adjustments').innerHTML = rows.length ? rows.map((r,i)=>{
    const a=r.adjustment||{};
    return `<div class="adjust-row" data-i="${i}">
      <span>${esc(r.category)}</span>
      <span>E${r.stage}</span>
      <span>B${r.heat}</span>
      <span>${esc(r.cust_id)}</span>
      <span>${esc(r.display_name)}</span>
      <input class="posOverride" type="number" min="1" max="30" placeholder="Pos." value="${a.position_override??''}">
      <input class="pointsDelta" type="number" placeholder="Δ pts" value="${a.points_delta??0}">
      <label style="margin:0"><input class="dq" type="checkbox" ${a.dq?'checked':''}> DQ</label>
      <input class="noteInput" type="text" placeholder="Nota" value="${esc(a.note??'')}">
      <button class="btn secondary saveAdj">Salvar</button>
    </div>`;
  }).join('') : '<p class="note">Importe pelo menos uma etapa.</p>';

  document.querySelectorAll('.saveAdj').forEach(btn=>{
    btn.onclick=async()=>{
      const row=btn.closest('.adjust-row');
      const r=rows[Number(row.dataset.i)];

      const payload={
        token,
        category:r.category,
        stage:r.stage,
        heat:r.heat,
        cust_id:r.cust_id,
        position_override:row.querySelector('.posOverride').value||null,
        points_delta:Number(row.querySelector('.pointsDelta').value||0),
        dq:row.querySelector('.dq').checked,
        note:row.querySelector('.noteInput').value
      };

      btn.textContent='...';

      const res=await fetch('../api/adjust.php',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });

      const j=await res.json();
      btn.textContent=j.ok?'OK':'Erro';
      if(!j.ok) alert(j.error||'Falha');
    };
  });
}
</script>
</body>
</html>
