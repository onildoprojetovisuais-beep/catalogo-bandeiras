<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/protests.php';
$protestId=protest_new_id();
$pixReady=protest_pix_ready();
$pixCode=''; $pixError='';
if ($pixReady) { try { $pixCode=protest_pix_payload($protestId); } catch(Throwable $e) { $pixReady=false; $pixError=$e->getMessage(); } }
$fee=number_format(protest_fee(),2,',','.');
?><!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Protestos | Caterham Esports Brasil</title>
<link rel="stylesheet" href="../assets/esports.css"><link rel="stylesheet" href="./assets/protests.css"></head>
<body class="cesb"><main class="cesb-wrap protest-wrap">
<div class="cesb-kicker">CATERHAM ESPORTS BRASIL · COMISSÁRIOS DESPORTIVOS</div>
<h1>Protestos</h1>
<p class="cesb-lead">Envie o protesto com replay do iRacing, informações do incidente e comprovante da taxa regulamentar.</p>
<div class="protest-alert"><b>Prazo:</b> até 24 horas após o encerramento da respectiva etapa. Protestos sem o arquivo <code>.rpy</code> ou sem as informações obrigatórias não serão admitidos.</div>
<form id="protestForm" enctype="multipart/form-data" novalidate>
<input class="hp" name="website" autocomplete="off" tabindex="-1">
<input type="hidden" name="protest_id" value="<?=htmlspecialchars($protestId,ENT_QUOTES)?>">
<div class="cesb-card"><h2>01 · Identificação</h2><div class="cesb-grid">
<div><label>Nome completo*</label><input name="full_name" required></div>
<div><label>E-mail da inscrição*</label><input name="email" type="email" required></div>
<div><label>iRacing Customer ID*</label><input name="iracing_customer_id" inputmode="numeric" required></div>
<div><label>Categoria*</label><select name="category" required><option value="">Selecione</option><option>Academy</option><option>420R</option></select></div>
</div></div>
<div class="cesb-card"><h2>02 · Incidente</h2><div class="cesb-grid">
<div><label>Etapa*</label><select name="stage" required><option value="">Selecione</option><option value="1">Etapa 1</option><option value="2">Etapa 2</option><option value="3">Etapa 3</option><option value="4">Etapa 4</option><option value="5">Etapa 5</option></select></div>
<div><label>Bateria*</label><select name="heat" required><option value="">Selecione</option><option value="1">Bateria 1</option><option value="2">Bateria 2</option></select></div>
<div><label>Volta do incidente*</label><input name="lap" type="number" min="1" step="1" required></div>
<div class="full"><label>Carros/pilotos envolvidos*</label><textarea name="cars_involved" required placeholder="Informe os pilotos/carros envolvidos no incidente."></textarea></div>
<div class="full"><label>Descrição objetiva do incidente ou decisão contestada*</label><textarea name="incident_description" required minlength="10" placeholder="Descreva objetivamente o que ocorreu."></textarea></div>
<div class="full"><label>Fundamento do protesto*</label><textarea name="protest_basis" required minlength="5" placeholder="Explique por que a situação deve ser analisada pelos Comissários Desportivos."></textarea></div>
</div></div>
<div class="cesb-card"><h2>03 · Replay</h2><label>Arquivo de replay do iRacing (.rpy)*</label><input name="replay_file" type="file" accept=".rpy" required><div class="cesb-help">Envie o replay correspondente ao momento do fato. Limite do módulo: 250 MiB; o servidor também precisa permitir esse tamanho de upload.</div></div>
<div class="cesb-card"><h2>04 · Taxa de protesto</h2>
<?php if($pixReady): ?>
<div class="pix-grid"><div><div id="pixQr" class="pix-qr" aria-label="QR Code Pix"></div><div id="qrFallback" class="cesb-help" hidden>Não foi possível desenhar o QR Code. Use o Pix Copia e Cola abaixo.</div></div><div>
<div class="pix-amount">R$ <?=$fee?></div><div class="cesb-help">Protocolo / txid: <b><?=htmlspecialchars($protestId)?></b></div>
<label for="pixCode">Pix Copia e Cola</label><textarea id="pixCode" readonly><?=htmlspecialchars($pixCode)?></textarea><button id="copyPix" class="cesb-button secondary" type="button">COPIAR CÓDIGO PIX</button>
</div></div>
<label>Comprovante de pagamento*</label><input name="payment_receipt" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" required><div class="cesb-help">PDF, PNG, JPG/JPEG ou WEBP. O envio do comprovante não representa validação automática do pagamento.</div>
<?php else: ?><div class="protest-error"><b>Pix ainda não configurado.</b> O formulário ficará bloqueado até a Organização preencher chave, nome e cidade do recebedor. <?=htmlspecialchars($pixError)?></div><?php endif; ?>
</div>
<div class="cesb-card"><h2>05 · Declaração</h2><div class="cesb-check"><input id="deadlineAck" name="deadline_ack" value="1" type="checkbox" required><label for="deadlineAck">Declaro estar ciente de que o protesto deve ser apresentado no prazo máximo regulamentar de 24 horas após o encerramento da etapa.</label></div>
<button id="submitProtest" class="cesb-button" type="submit" <?=$pixReady?'':'disabled'?>>ENVIAR PROTESTO</button><div id="protestMessage" class="cesb-message"></div>
</div></form></main>
<script>window.CESB_PROTEST_PIX=<?=json_encode($pixCode,JSON_UNESCAPED_SLASHES)?>;</script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js" defer></script><script src="./assets/protests.js" defer></script></body></html>
