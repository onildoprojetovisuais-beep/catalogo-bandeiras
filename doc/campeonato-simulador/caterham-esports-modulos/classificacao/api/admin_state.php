<?php
declare(strict_types=1);
header('X-Robots-Tag: noindex, nofollow', true);

require_once dirname(__DIR__) . '/lib/standings.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $token=(string)($_GET['token']??$_SERVER['HTTP_X_ADMIN_TOKEN']??'');
    cls_assert_admin($token);
    echo json_encode(
        ['ok'=>true,'data'=>cls_admin_state()],
        JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES
    );
} catch(Throwable $e){
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);
}
