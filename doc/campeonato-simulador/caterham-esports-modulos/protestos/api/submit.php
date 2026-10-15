<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/protests.php';
if ($_SERVER['REQUEST_METHOD']!=='POST') protest_json(['ok'=>false,'error'=>'Use POST.'],405);
try {
    $entry=protest_submit($_POST,$_FILES);
    protest_json(['ok'=>true,'protest_id'=>$entry['protest_id'],'payment_status'=>$entry['payment_status'],'sporting_status'=>$entry['sporting_status']]);
} catch(DomainException $e) { protest_json(['ok'=>false,'error'=>$e->getMessage()],409);
} catch(InvalidArgumentException $e) { protest_json(['ok'=>false,'error'=>$e->getMessage()],422);
} catch(Throwable $e) { protest_json(['ok'=>false,'error'=>'Não foi possível registrar o protesto. '.$e->getMessage()],500); }
