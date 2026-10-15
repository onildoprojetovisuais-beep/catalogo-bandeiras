(() => {
  const category = document.body.dataset.category;
  if (!category) return;

  let categoryData = null;
  let mode = 'without_drops';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function cell(r){
    const useDrop = mode === 'with_drops' && r.dropped;

    if(r.status==='PENDING') return '<td>—</td>';

    if(r.status==='ABS') return `<td class="${useDrop?'drop':''}">
      <span class="cell-pos">ABS</span>
      <span class="cell-pts">0 pts${useDrop?' · descarte':''}</span>
    </td>`;

    if(r.status==='DQ') return `<td class="dq">
      <span class="cell-pos">DQ</span>
      <span class="cell-pts">0 pts</span>
    </td>`;

    if(r.status==='NC') return `<td class="nc ${useDrop?'drop':''}">
      <span class="cell-pos">NC</span>
      <span class="cell-pts">0 pts${useDrop?' · descarte':''}</span>
    </td>`;

    return `<td class="${useDrop?'drop':''}">
      <span class="cell-pos">P${r.position}</span>
      <span class="cell-pts">${r.points} pts${r.adjusted?' *':''}${useDrop?' · descarte':''}</span>
    </td>`;
  }

  function render(){
    if(!categoryData) return;

    const entries = mode === 'with_drops'
      ? (categoryData.entries_with_drops || [])
      : (categoryData.entries_without_drops || []);

    document.getElementById('completed').textContent =
      `${categoryData.completed_heats}/${categoryData.total_heats} baterias`;

    const desc = document.getElementById('modeDescription');
    if(mode === 'with_drops'){
      desc.textContent = categoryData.championship_complete
        ? 'Classificação com os 2 descartes regulamentares aplicados.'
        : 'Projeção com 2 descartes considerando somente as baterias já disputadas.';
    }else{
      desc.textContent = 'Classificação pelos pontos brutos, sem qualquer descarte.';
    }

    document.querySelectorAll('[data-mode]').forEach(b=>{
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    let head='<tr><th>Pos.</th><th class="driver">Piloto</th>';
    for(let s=1;s<=5;s++) head += `<th>E${s} B1</th><th>E${s} B2</th>`;
    head += mode === 'with_drops'
      ? '<th>Bruto</th><th>C/ descartes</th></tr>'
      : '<th>Bruto</th><th>Pontos</th></tr>';

    const body=entries.map(e=>`<tr>
      <td class="pos">${e.position}</td>
      <td class="driver">${esc(e.display_name)}</td>
      ${e.results.map(cell).join('')}
      <td><b>${e.gross_points}</b></td>
      <td><b>${mode==='with_drops' ? e.points_with_drops : e.points_without_drops}</b></td>
    </tr>`).join('');

    document.getElementById('standingsHead').innerHTML=head;
    document.getElementById('standingsBody').innerHTML =
      body || '<tr><td colspan="14">Ainda sem resultados importados.</td></tr>';
  }

  document.querySelectorAll('[data-mode]').forEach(b=>{
    b.addEventListener('click',()=>{
      mode=b.dataset.mode;
      render();
    });
  });

  fetch('../public/standings.json?v='+Date.now(), {cache:'no-store'})
    .then(r=>r.json())
    .then(data=>{
      categoryData = data.categories?.[category] ?? null;
      if(!categoryData) throw new Error('Categoria inexistente.');

      // Antes do final, abre em bruto. Depois das 10 baterias, abre no oficial com descartes.
      mode = categoryData.championship_complete ? 'with_drops' : 'without_drops';
      render();
    })
    .catch(()=>{
      document.getElementById('standingsBody').innerHTML =
        '<tr><td>Classificação indisponível.</td></tr>';
    });
})();
