<?php
declare(strict_types=1);

/*
 * Caterham Esports Brasil — módulo de Protestos e Recursos
 * Atualização independente do módulo de inscrição/ranking.
 *
 * Configure preferencialmente por variáveis de ambiente.
 */

// Tenta reutilizar o config principal, sem sobrescrevê-lo.
$mainConfig = dirname(__DIR__) . '/config.php';
if (is_file($mainConfig)) require_once $mainConfig;

const CATERHAM_PROTEST_DEFAULT_FEE = 50.00;
const CATERHAM_PROTEST_MAX_REPLAY_BYTES = 262144000; // 250 MiB
const CATERHAM_PROTEST_MAX_RECEIPT_BYTES = 15728640; // 15 MiB

function protest_env(string $name, string $default=''): string {
    $v = getenv($name);
    return ($v !== false && trim($v) !== '') ? trim($v) : $default;
}
function protest_env_bool(string $name, bool $default): bool {
    $v = getenv($name);
    if ($v === false || trim($v) === '') return $default;
    return in_array(strtolower(trim($v)), ['1','true','yes','on','sim'], true);
}
function protest_fee(): float {
    $v = (float)str_replace(',', '.', protest_env('CATERHAM_PROTEST_FEE', (string)CATERHAM_PROTEST_DEFAULT_FEE));
    return $v > 0 ? round($v, 2) : CATERHAM_PROTEST_DEFAULT_FEE;
}
function protest_pix_key(): string { return protest_env('CATERHAM_PROTEST_PIX_KEY'); }
function protest_pix_name(): string { return protest_env('CATERHAM_PROTEST_PIX_NAME'); }
function protest_pix_city(): string { return protest_env('CATERHAM_PROTEST_PIX_CITY'); }
function protest_require_registered(): bool { return protest_env_bool('CATERHAM_PROTEST_REQUIRE_REGISTERED', true); }
function protest_admin_token(): string {
    $own = protest_env('CATERHAM_PROTEST_ADMIN_TOKEN');
    if ($own !== '') return $own;
    if (function_exists('caterham_admin_token')) return caterham_admin_token();
    return protest_env('CATERHAM_ADMIN_TOKEN', 'CHANGE_ME_BEFORE_PRODUCTION');
}
function protest_storage_dir(): string { return __DIR__ . '/storage'; }
function protest_state_file(): string { return protest_storage_dir() . '/protests.json'; }
function protest_uploads_dir(): string { return protest_storage_dir() . '/uploads'; }
function protest_lock_file(): string { return protest_storage_dir() . '/protests.lock'; }
function protest_registrations_file(): string { return dirname(__DIR__) . '/storage/registrations.json'; }
