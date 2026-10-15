<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Caterham Academy — Caterham Esports Brasil</title>
<link rel="stylesheet" href="../assets/classificacao.css">
</head>
<body data-category="Academy">
<main>
<p><a href="../" style="color:#f47b20;text-decoration:none">← Classificação</a></p>
<h1>Caterham Academy</h1>
<p class="sub">Caterham Esports Brasil</p>

<section class="card">
  <div class="summary">
    <div class="pill"><b id="completed">0/10 baterias</b></div>
  </div>

  <div class="standings-modes" role="group" aria-label="Modo da classificação">
    <button type="button" class="mode-button active" data-mode="without_drops">Sem descartes</button>
    <button type="button" class="mode-button" data-mode="with_drops">Com 2 descartes</button>
  </div>

  <p id="modeDescription" class="note">Classificação pelos pontos brutos, sem qualquer descarte.</p>

  <div class="table-wrap">
    <table>
      <thead id="standingsHead"></thead>
      <tbody id="standingsBody"></tbody>
    </table>
  </div>
</section>

<p class="note">
* Ajustes pós-prova podem alterar posições e pontos.
Os 2 descartes regulamentares são aplicados ao final das 10 baterias deste campeonato.
</p>
</main>
<script src="../assets/classificacao.js"></script>
</body>
</html>
