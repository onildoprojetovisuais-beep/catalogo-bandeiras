<?php
declare(strict_types=1);

/*
 * Caterham Esports Brasil — Classificação V2
 *
 * Academy e 420R são eventos separados no iRacing.
 * Cada categoria recebe seu próprio eventresult.json por etapa.
 */

const CLS_ROOT = __DIR__;
const CLS_STORAGE = CLS_ROOT . '/storage';
const CLS_PUBLIC = CLS_ROOT . '/public';

const CLS_STATE_FILE = CLS_STORAGE . '/championship.json';
const CLS_ADJUSTMENTS_FILE = CLS_STORAGE . '/adjustments.json';
const CLS_PUBLIC_FILE = CLS_PUBLIC . '/standings.json';
const CLS_LOCK_FILE = CLS_STORAGE . '/update.lock';

const CLS_NUM_STAGES = 5;
const CLS_HEATS_PER_STAGE = 2;
const CLS_DROP_COUNT = 2;
const CLS_DROPS_ONLY_WHEN_COMPLETE = true;

function cls_admin_token(): string {
    return (string)(getenv('CATERHAM_ADMIN_TOKEN') ?: 'TROQUE-ESTE-TOKEN');
}

function cls_categories(): array {
    return ['Academy', '420R'];
}

function cls_points_table(): array {
    $points = [1 => 31];
    for ($p = 2; $p <= 30; $p++) {
        $points[$p] = 31 - $p;
    }
    return $points;
}
