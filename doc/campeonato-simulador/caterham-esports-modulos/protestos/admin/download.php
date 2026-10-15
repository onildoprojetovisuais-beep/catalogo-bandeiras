<?php
declare(strict_types=1);
header('X-Robots-Tag: noindex, nofollow', true);
session_start();
require_once dirname(__DIR__) . '/lib/protests.php';
if (empty($_SESSION['protest_admin'])) { http_response_code(403); exit('Acesso negado.'); }
$id=(string)($_GET['id'] ?? ''); $kind=(string)($_GET['file'] ?? '');
if (!protest_valid_id($id) || !in_array($kind,['replay','payment'],true)) { http_response_code(400); exit('Parâmetros inválidos.'); }
$state=protest_state(); $entry=$state['entries'][$id] ?? null;
if (!is_array($entry)) { http_response_code(404); exit('Protesto não encontrado.'); }
$path=protest_file_path($entry,$kind); if(!$path){http_response_code(404);exit('Arquivo não encontrado.');}
$meta=$kind==='replay'?$entry['replay']:$entry['payment_receipt'];
$name=preg_replace('/[^A-Za-z0-9._-]/','_',basename((string)($meta['original_name'] ?? basename($path)))) ?: basename($path);
header('Content-Type: application/octet-stream'); header('Content-Length: '.filesize($path)); header('Content-Disposition: attachment; filename="'.$name.'"'); header('X-Content-Type-Options: nosniff'); readfile($path); exit;
