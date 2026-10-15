<?php
declare(strict_types=1);
header('X-Robots-Tag: noindex, nofollow', true);

require_once dirname(__DIR__) . '/lib/standings.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new RuntimeException('Use POST.',405);

    $input = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($input)) $input = [];

    $token = (string)($input['token'] ?? $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
    cls_assert_admin($token);

    $category = (string)($input['category'] ?? '');
    $stage = (int)($input['stage'] ?? 0);
    $heat = (int)($input['heat'] ?? 0);
    $custId = trim((string)($input['cust_id'] ?? ''));

    $position = $input['position_override'] ?? null;
    $position = ($position === null || $position === '') ? null : (int)$position;

    $standings = cls_save_adjustment(
        $category,
        $stage,
        $heat,
        $custId,
        $position,
        (int)($input['points_delta'] ?? 0),
        (bool)($input['dq'] ?? false),
        (string)($input['note'] ?? '')
    );

    echo json_encode(
        ['ok'=>true,'generated_at'=>$standings['generated_at']],
        JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE
    );
} catch (Throwable $e) {
    $code=$e->getCode();
    http_response_code($code>=400&&$code<=599?$code:400);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);
}
