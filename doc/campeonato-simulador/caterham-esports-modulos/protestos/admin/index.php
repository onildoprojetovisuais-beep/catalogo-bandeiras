<?php
declare(strict_types=1);

header('X-Robots-Tag: noindex, nofollow', true);
session_start();
require_once dirname(__DIR__) . '/lib/protests.php';

if (empty($_SESSION['protest_csrf'])) {
    $_SESSION['protest_csrf'] = bin2hex(random_bytes(16));
}

$error = '';

if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ./');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['admin_token'])) {
    if (hash_equals(protest_admin_token(), (string)$_POST['admin_token'])) {
        $_SESSION['protest_admin'] = true;
    } else {
        $error = 'Token inválido.';
    }
}

$auth = !empty($_SESSION['protest_admin']);

if ($auth && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_id'])) {
    if (!hash_equals((string)$_SESSION['protest_csrf'], (string)($_POST['csrf'] ?? ''))) {
        die('CSRF inválido');
    }

    $id = (string)$_POST['update_id'];

    // Status exclusivamente desportivos.
    $statuses = ['received', 'under_review', 'upheld', 'rejected', 'not_admitted'];
    $status = in_array((string)($_POST['sporting_status'] ?? ''), $statuses, true)
        ? (string)$_POST['sporting_status']
        : 'received';

    // Situação financeira é separada do julgamento desportivo.
    $paymentStatuses = [
        'proof_submitted_pending_verification',
        'verified',
        'refund_due',
        'refunded'
    ];
    $pay = in_array((string)($_POST['payment_status'] ?? ''), $paymentStatuses, true)
        ? (string)$_POST['payment_status']
        : 'proof_submitted_pending_verification';

    /*
     * Protesto procedente => a taxa deve ser devolvida.
     * O sistema não marca "devolvido" automaticamente porque isso só deve
     * acontecer depois da transferência efetiva. Em vez disso, passa a
     * "Devolução pendente".
     */
    if ($status === 'upheld' && $pay !== 'refunded') {
        $pay = 'refund_due';
    }

    /*
     * Se ainda não houve devolução e o julgamento deixar de ser procedente,
     * remove a pendência automática.
     */
    if ($status !== 'upheld' && $pay === 'refund_due') {
        $pay = 'verified';
    }

    $notes = protest_clean($_POST['admin_notes'] ?? '', 3000);

    protest_with_lock(function() use ($id, $status, $pay, $notes) {
        $s = protest_state();

        if (isset($s['entries'][$id])) {
            $s['entries'][$id]['sporting_status'] = $status;
            $s['entries'][$id]['payment_status'] = $pay;
            $s['entries'][$id]['admin_notes'] = $notes;
            $s['entries'][$id]['updated_at'] = protest_now();
            $s['updated_at'] = protest_now();
            protest_write_json_atomic(protest_state_file(), $s);
        }
    });

    header('Location: ./');
    exit;
}

$state = $auth ? protest_state() : ['entries' => []];
$entries = array_values($state['entries'] ?? []);
usort(
    $entries,
    fn($a, $b) => strcmp((string)($b['submitted_at'] ?? ''), (string)($a['submitted_at'] ?? ''))
);
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Admin Protestos</title>
<link rel="stylesheet" href="../../assets/esports.css">
<link rel="stylesheet" href="../assets/protests.css">
<style>
.admin-table{width:100%;border-collapse:collapse;font-size:13px}
.admin-table th,.admin-table td{padding:8px;border-bottom:1px solid #333;vertical-align:top;text-align:left}
.admin-protest{margin:16px 0}
.admin-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.admin-actions textarea{grid-column:1/-1;min-height:70px}
.financial-note{font-size:12px;color:#aaa;margin-top:6px}
</style>
</head>
<body class="cesb">
<main class="cesb-wrap">
<h1>Admin · Protestos</h1>

<?php if (!$auth): ?>
<div class="cesb-card">
<form method="post">
<label>Token administrativo</label>
<input name="admin_token" type="password" required>
<button class="cesb-button">ENTRAR</button>
<div class="cesb-message error"><?=htmlspecialchars($error)?></div>
</form>
</div>

<?php else: ?>
<p><a href="?logout=1" style="color:#f47b20">Sair</a></p>
<div class="cesb-card"><b><?=count($entries)?></b> protesto(s) registrado(s).</div>

<?php foreach ($entries as $e): ?>
<article class="cesb-card admin-protest">
<h2><?=htmlspecialchars((string)$e['protest_id'])?> · <?=htmlspecialchars((string)$e['full_name'])?></h2>

<p>
<b>Categoria:</b> <?=htmlspecialchars((string)$e['category'])?> ·
<b>Etapa:</b> <?=intval($e['stage'])?> ·
<b>Bateria:</b> <?=intval($e['heat'])?> ·
<b>Volta:</b> <?=intval($e['lap'])?>
</p>

<p>
<b>Customer ID:</b> <?=htmlspecialchars((string)$e['iracing_customer_id'])?> ·
<b>Enviado:</b> <?=htmlspecialchars((string)$e['submitted_at'])?>
</p>

<p><b>Envolvidos:</b><br><?=nl2br(htmlspecialchars((string)$e['cars_involved']))?></p>
<p><b>Descrição:</b><br><?=nl2br(htmlspecialchars((string)$e['incident_description']))?></p>
<p><b>Fundamento:</b><br><?=nl2br(htmlspecialchars((string)$e['protest_basis']))?></p>

<p>
<a class="cesb-button secondary"
href="download.php?id=<?=urlencode((string)$e['protest_id'])?>&file=replay">Baixar .rpy</a>
<a class="cesb-button secondary"
href="download.php?id=<?=urlencode((string)$e['protest_id'])?>&file=payment">Baixar comprovante</a>
</p>

<form method="post" class="admin-actions">
<input type="hidden" name="csrf" value="<?=htmlspecialchars((string)$_SESSION['protest_csrf'])?>">
<input type="hidden" name="update_id" value="<?=htmlspecialchars((string)$e['protest_id'])?>">

<div>
<label>Status desportivo</label>
<select name="sporting_status">
<option value="received" <?=$e['sporting_status']==='received'?'selected':''?>>Recebido</option>
<option value="under_review" <?=$e['sporting_status']==='under_review'?'selected':''?>>Em análise</option>
<option value="upheld" <?=$e['sporting_status']==='upheld'?'selected':''?>>Procedente</option>
<option value="rejected" <?=$e['sporting_status']==='rejected'?'selected':''?>>Improcedente</option>
<option value="not_admitted" <?=$e['sporting_status']==='not_admitted'?'selected':''?>>Não admitido</option>
</select>
</div>

<div>
<label>Situação financeira</label>
<select name="payment_status">
<option value="proof_submitted_pending_verification"
<?=$e['payment_status']==='proof_submitted_pending_verification'?'selected':''?>>
Comprovante pendente
</option>
<option value="verified" <?=$e['payment_status']==='verified'?'selected':''?>>
Pagamento verificado
</option>
<option value="refund_due" <?=$e['payment_status']==='refund_due'?'selected':''?>>
Devolução pendente
</option>
<option value="refunded" <?=$e['payment_status']==='refunded'?'selected':''?>>
Devolvido
</option>
</select>
<p class="financial-note">
Ao marcar o protesto como <b>Procedente</b>, o sistema define automaticamente
a situação financeira como <b>Devolução pendente</b>. Após efetuar o Pix,
marque como <b>Devolvido</b>.
</p>
</div>

<textarea name="admin_notes" placeholder="Anotações internas"><?=htmlspecialchars((string)($e['admin_notes']??''))?></textarea>
<button class="cesb-button">SALVAR</button>
</form>
</article>
<?php endforeach; ?>

<?php endif; ?>
</main>
</body>
</html>
