<?php
declare(strict_types=1);
header('X-Robots-Tag: noindex, nofollow', true);

require_once dirname(__DIR__) . '/lib/standings.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new RuntimeException('Use POST.', 405);
    }

    $token = (string)($_POST['token'] ?? $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
    cls_assert_admin($token);

    $category = (string)($_POST['category'] ?? '');
    $stage = (int)($_POST['stage'] ?? 0);
    $replace = isset($_POST['replace']) && in_array(
        strtolower((string)$_POST['replace']),
        ['1','true','on','yes'],
        true
    );

    if (!isset($_FILES['result_file']) || $_FILES['result_file']['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Arquivo eventresult não enviado.');
    }

    $name = basename((string)$_FILES['result_file']['name']);
    if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) !== 'json') {
        throw new RuntimeException('Envie um arquivo .json.');
    }

    if ((int)$_FILES['result_file']['size'] > 20 * 1024 * 1024) {
        throw new RuntimeException('Arquivo acima de 20 MB.');
    }

    $result = cls_import_stage(
        (string)$_FILES['result_file']['tmp_name'],
        $name,
        $category,
        $stage,
        $replace
    );

    echo json_encode(
        ['ok'=>true,'result'=>$result],
        JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES
    );
} catch (Throwable $e) {
    $code = $e->getCode();
    http_response_code($code >= 400 && $code <= 599 ? $code : 400);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
