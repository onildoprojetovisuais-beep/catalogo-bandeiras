<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/config.php';

function cls_now(): string { return gmdate('c'); }

function cls_json_load(string $path, array $default): array {
    if (!is_file($path)) return $default;
    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') return $default;
    $v = json_decode($raw, true);
    return is_array($v) ? $v : $default;
}

function cls_json_save_atomic(string $path, array $data): void {
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0775, true);

    $tmp = $path . '.tmp.' . bin2hex(random_bytes(5));
    $json = json_encode(
        $data,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    if ($json === false) throw new RuntimeException('Falha ao serializar JSON.');

    if (file_put_contents($tmp, $json . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('Falha ao gravar arquivo.');
    }

    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Falha ao substituir arquivo.');
    }
}

function cls_assert_admin(string $token): void {
    if (!hash_equals(cls_admin_token(), $token)) {
        throw new RuntimeException('Token administrativo inválido.', 403);
    }
}

function cls_validate_category(string $category): string {
    if (!in_array($category, cls_categories(), true)) {
        throw new RuntimeException('Categoria inválida.');
    }
    return $category;
}

function cls_finish_position(array $r): int {
    /*
     * iRacing usa finish_position zero-based no eventresult.
     * 0 = P1.
     */
    $p = (int)($r['finish_position'] ?? $r['position'] ?? -1);
    return $p >= 0 ? $p + 1 : PHP_INT_MAX;
}

function cls_is_dq_reason(string $reason): bool {
    $v = strtolower($reason);
    return str_contains($v, 'disqual') || $v === 'dq' || str_contains($v, 'dq ');
}

function cls_find_race_sessions(array $data): array {
    $races = [];

    foreach (($data['session_results'] ?? []) as $s) {
        if (!is_array($s) || empty($s['results'])) continue;

        $type = strtoupper((string)($s['simsession_type_name'] ?? ''));
        $name = strtoupper((string)($s['simsession_name'] ?? ''));

        if ($type === 'RACE' || str_contains($name, 'HEAT') || str_contains($name, 'FEATURE')) {
            $races[] = $s;
        }
    }

    usort($races, fn($a, $b) =>
        ((int)($a['simsession_number'] ?? 0)) <=> ((int)($b['simsession_number'] ?? 0))
    );

    if (count($races) !== 2) {
        throw new RuntimeException(
            'O JSON deve conter exatamente duas sessões de corrida. Encontradas: ' . count($races)
        );
    }

    return array_values($races);
}

function cls_normalize_heat(array $session, string $category, int $stage, int $heat): array {
    $results = array_values(array_filter(
        $session['results'] ?? [],
        fn($r) => is_array($r) && isset($r['cust_id'])
    ));

    usort($results, fn($a, $b) => cls_finish_position($a) <=> cls_finish_position($b));

    $winnerLaps = 0;
    foreach ($results as $r) {
        $winnerLaps = max($winnerLaps, (int)($r['laps_complete'] ?? 0));
    }

    // Regulamento: 75%, com fração arredondada para baixo.
    $threshold = (int)floor($winnerLaps * 0.75);
    $pointsTable = cls_points_table();

    $rows = [];

    foreach ($results as $index => $r) {
        $position = $index + 1;
        $laps = (int)($r['laps_complete'] ?? 0);
        $reason = (string)($r['reason_out'] ?? '');
        $serverDq = cls_is_dq_reason($reason);
        $classified = !$serverDq && $laps >= $threshold;

        $rows[] = [
            'category' => $category,
            'stage' => $stage,
            'heat' => $heat,
            'cust_id' => (string)$r['cust_id'],
            'display_name' => (string)($r['display_name'] ?? ''),
            'car_name' => (string)($r['car_name'] ?? ''),
            'car_number' => (string)($r['livery']['car_number'] ?? ''),
            'raw_position' => $position,
            'server_finish_position' => cls_finish_position($r),
            'laps_complete' => $laps,
            'winner_laps' => $winnerLaps,
            'threshold_laps' => $threshold,
            'classified_75' => $classified,
            'server_dq' => $serverDq,
            'reason_out' => $reason,
            'base_points' => $classified ? (int)($pointsTable[$position] ?? 0) : 0,
            'incidents' => isset($r['incidents']) ? (int)$r['incidents'] : null,
        ];
    }

    return [
        'simsession_number' => (int)($session['simsession_number'] ?? 0),
        'simsession_name' => (string)($session['simsession_name'] ?? ('Bateria ' . $heat)),
        'winner_laps' => $winnerLaps,
        'threshold_laps' => $threshold,
        'results' => $rows,
    ];
}

function cls_parse_eventresult(
    array $payload,
    string $category,
    int $stage,
    string $sourceFile
): array {
    cls_validate_category($category);

    if ($stage < 1 || $stage > CLS_NUM_STAGES) {
        throw new RuntimeException('Número de etapa inválido.');
    }

    if (($payload['type'] ?? null) !== 'event_result' || !isset($payload['data'])) {
        throw new RuntimeException('Arquivo não é um event_result válido do iRacing.');
    }

    $data = $payload['data'];
    $races = cls_find_race_sessions($data);
    $track = is_array($data['track'] ?? null) ? $data['track'] : [];

    $carNames = [];
    foreach ($races as $race) {
        foreach (($race['results'] ?? []) as $r) {
            $name = trim((string)($r['car_name'] ?? ''));
            if ($name !== '') $carNames[$name] = true;
        }
    }

    return [
        'category' => $category,
        'stage' => $stage,
        'subsession_id' => (string)($data['subsession_id'] ?? ''),
        'session_name' => (string)($data['session_name'] ?? ''),
        'start_time' => (string)($data['start_time'] ?? ''),
        'end_time' => (string)($data['end_time'] ?? ''),
        'track_name' => (string)($track['track_name'] ?? ''),
        'track_config' => (string)($track['config_name'] ?? ''),
        'source_file' => $sourceFile,
        'imported_at' => cls_now(),
        'car_names_detected' => array_keys($carNames),
        'heats' => [
            '1' => cls_normalize_heat($races[0], $category, $stage, 1),
            '2' => cls_normalize_heat($races[1], $category, $stage, 2),
        ],
    ];
}

function cls_state_default(): array {
    return [
        'categories' => [
            'Academy' => ['stages' => []],
            '420R' => ['stages' => []],
        ],
    ];
}

function cls_adjustment_key(string $category, int $stage, int $heat, string $custId): string {
    return $category . ':' . $stage . ':' . $heat . ':' . $custId;
}

function cls_get_adjustments(): array {
    $raw = cls_json_load(CLS_ADJUSTMENTS_FILE, ['adjustments' => []]);
    return is_array($raw['adjustments'] ?? null) ? $raw['adjustments'] : [];
}

function cls_apply_heat_adjustments(
    array $rows,
    string $category,
    int $stage,
    int $heat,
    array $adjustments
): array {
    usort($rows, fn($a, $b) => $a['raw_position'] <=> $b['raw_position']);

    /*
     * Ajuste de posição:
     * remove o piloto da posição original e reinsere na posição oficial.
     */
    $moves = [];

    foreach ($rows as $r) {
        $key = cls_adjustment_key($category, $stage, $heat, (string)$r['cust_id']);
        $adj = $adjustments[$key] ?? [];

        if (
            isset($adj['position_override'])
            && $adj['position_override'] !== null
            && $adj['position_override'] !== ''
        ) {
            $moves[] = [
                'cust_id' => (string)$r['cust_id'],
                'position' => max(1, (int)$adj['position_override']),
                'updated_at' => (string)($adj['updated_at'] ?? ''),
            ];
        }
    }

    usort($moves, fn($a, $b) => strcmp($a['updated_at'], $b['updated_at']));

    foreach ($moves as $move) {
        $idx = null;
        foreach ($rows as $i => $r) {
            if ((string)$r['cust_id'] === $move['cust_id']) {
                $idx = $i;
                break;
            }
        }
        if ($idx === null) continue;

        $driver = $rows[$idx];
        array_splice($rows, $idx, 1);
        $target = max(0, min(count($rows), $move['position'] - 1));
        array_splice($rows, $target, 0, [$driver]);
    }

    $pointsTable = cls_points_table();
    $out = [];

    foreach ($rows as $i => $r) {
        $officialPosition = $i + 1;
        $key = cls_adjustment_key($category, $stage, $heat, (string)$r['cust_id']);
        $adj = $adjustments[$key] ?? [];

        $manualDq = (bool)($adj['dq'] ?? false);
        $pointsDelta = (int)($adj['points_delta'] ?? 0);

        $eligible = (bool)$r['classified_75'] && !(bool)$r['server_dq'] && !$manualDq;
        $positionPoints = $eligible ? (int)($pointsTable[$officialPosition] ?? 0) : 0;
        $points = $eligible ? max(0, $positionPoints + $pointsDelta) : 0;

        $r['official_position'] = $officialPosition;
        $r['position_points'] = $positionPoints;
        $r['points_delta'] = $pointsDelta;
        $r['points'] = $points;
        $r['manual_dq'] = $manualDq;
        $r['dq'] = (bool)$r['server_dq'] || $manualDq;
        $r['adjustment_note'] = (string)($adj['note'] ?? '');
        $r['adjusted'] = !empty($adj);

        $out[] = $r;
    }

    return $out;
}

function cls_slots(): array {
    $slots = [];
    for ($s = 1; $s <= CLS_NUM_STAGES; $s++) {
        for ($h = 1; $h <= CLS_HEATS_PER_STAGE; $h++) {
            $slots[] = [$s, $h];
        }
    }
    return $slots;
}

function cls_completed_heats_for_category(array $catState): int {
    $count = 0;
    foreach (($catState['stages'] ?? []) as $stage) {
        foreach (($stage['heats'] ?? []) as $heat) {
            if (!empty($heat['results'])) $count++;
        }
    }
    return $count;
}

function cls_position_counts(array $slots): array {
    $counts = [];
    foreach ($slots as $r) {
        if (!$r || $r['dq'] || !$r['classified_75']) continue;
        $p = (int)$r['official_position'];
        $counts[$p] = ($counts[$p] ?? 0) + 1;
    }
    return $counts;
}

function cls_reverse_position_vector(array $slots): array {
    $vec = [];
    foreach (array_reverse(cls_slots()) as [$s, $h]) {
        $key = $s . ':' . $h;
        $r = $slots[$key] ?? null;
        $vec[] = $r && !$r['dq'] && $r['classified_75']
            ? (int)$r['official_position']
            : 9999;
    }
    return $vec;
}

function cls_compare_entries_by_field(array $a, array $b, string $field): int {
    if ($a[$field] !== $b[$field]) return $b[$field] <=> $a[$field];

    // Regulamento: maior número de vitórias, depois P2, P3 etc.
    for ($p = 1; $p <= 30; $p++) {
        $ca = (int)($a['_position_counts'][$p] ?? 0);
        $cb = (int)($b['_position_counts'][$p] ?? 0);
        if ($ca !== $cb) return $cb <=> $ca;
    }

    // Depois, melhor resultado na última bateria válida e regressivamente.
    $va = $a['_reverse_vector'];
    $vb = $b['_reverse_vector'];
    $n = max(count($va), count($vb));

    for ($i = 0; $i < $n; $i++) {
        $pa = $va[$i] ?? 9999;
        $pb = $vb[$i] ?? 9999;
        if ($pa !== $pb) return $pa <=> $pb;
    }

    return strcmp((string)$a['_cust_id'], (string)$b['_cust_id']);
}

function cls_completed_slot_keys(array $catState): array {
    $keys = [];

    foreach (($catState['stages'] ?? []) as $stageNo => $stage) {
        for ($heat = 1; $heat <= CLS_HEATS_PER_STAGE; $heat++) {
            if (isset($stage['heats'][(string)$heat])) {
                $keys[] = ((int)$stageNo) . ':' . $heat;
            }
        }
    }

    return $keys;
}

function cls_build_category_standings(
    string $category,
    array $catState,
    array $adjustments
): array {
    $completedHeats = cls_completed_heats_for_category($catState);
    $complete = $completedHeats >= CLS_NUM_STAGES * CLS_HEATS_PER_STAGE;
    $completedSlotKeys = cls_completed_slot_keys($catState);

    $driverSlots = [];
    $names = [];

    foreach (($catState['stages'] ?? []) as $stageNo => $stage) {
        for ($heat = 1; $heat <= CLS_HEATS_PER_STAGE; $heat++) {
            $heatData = $stage['heats'][(string)$heat] ?? null;
            if (!$heatData) continue;

            $rows = cls_apply_heat_adjustments(
                $heatData['results'] ?? [],
                $category,
                (int)$stageNo,
                $heat,
                $adjustments
            );

            foreach ($rows as $r) {
                $cid = (string)$r['cust_id'];
                $slot = $stageNo . ':' . $heat;
                $driverSlots[$cid][$slot] = $r;
                $names[$cid] = $r['display_name'];
            }
        }
    }

    $entries = [];

    foreach ($names as $cid => $name) {
        $slots = [];
        $gross = 0;

        foreach (cls_slots() as [$stage, $heat]) {
            $key = $stage . ':' . $heat;
            $r = $driverSlots[$cid][$key] ?? null;
            $slots[$key] = $r;

            if ($r !== null) {
                $gross += (int)$r['points'];
            }
        }

        /*
         * A visualização "com descartes" é calculada sempre, inclusive antes
         * do fim do campeonato, mas SOMENTE entre baterias já disputadas.
         *
         * Baterias futuras nunca entram como ausência/zero.
         * Ausência em bateria já disputada é descartável.
         * DQ não é descartável.
         */
        $discardable = [];

        foreach ($completedSlotKeys as $key) {
            $r = $slots[$key] ?? null;

            if ($r !== null && $r['dq']) {
                continue;
            }

            [$stage, $heat] = array_map('intval', explode(':', $key));

            $discardable[] = [
                'key' => $key,
                'points' => $r !== null ? (int)$r['points'] : 0,
                'stage' => $stage,
                'heat' => $heat,
            ];
        }

        usort($discardable, function($a, $b) {
            if ($a['points'] !== $b['points']) return $a['points'] <=> $b['points'];
            if ($a['stage'] !== $b['stage']) return $a['stage'] <=> $b['stage'];
            return $a['heat'] <=> $b['heat'];
        });

        $dropKeys = [];
        $pointsWithDrops = $gross;

        foreach (array_slice($discardable, 0, CLS_DROP_COUNT) as $d) {
            $dropKeys[$d['key']] = true;
            $pointsWithDrops -= $d['points'];
        }

        $publicResults = [];

        foreach (cls_slots() as [$stage, $heat]) {
            $key = $stage . ':' . $heat;
            $r = $slots[$key];

            if ($r === null) {
                $stageImported = isset($catState['stages'][(string)$stage]);

                $publicResults[] = [
                    'stage' => $stage,
                    'heat' => $heat,
                    'status' => $stageImported ? 'ABS' : 'PENDING',
                    'position' => null,
                    'points' => $stageImported ? 0 : null,
                    'dropped' => isset($dropKeys[$key]),
                ];
                continue;
            }

            $status = 'OK';
            if ($r['dq']) $status = 'DQ';
            elseif (!$r['classified_75']) $status = 'NC';

            $publicResults[] = [
                'stage' => $stage,
                'heat' => $heat,
                'status' => $status,
                'position' => $r['official_position'],
                'points' => (int)$r['points'],
                'dropped' => isset($dropKeys[$key]),
                'adjusted' => (bool)$r['adjusted'],
            ];
        }

        $entries[] = [
            '_cust_id' => $cid,
            'display_name' => $name,
            'gross_points' => $gross,
            'points_without_drops' => $gross,
            'points_with_drops' => $pointsWithDrops,
            'projected_drop_count' => count($dropKeys),
            'results' => $publicResults,
            '_position_counts' => cls_position_counts($slots),
            '_reverse_vector' => cls_reverse_position_vector($slots),
        ];
    }

    $withoutDrops = $entries;
    usort(
        $withoutDrops,
        fn($a, $b) => cls_compare_entries_by_field($a, $b, 'points_without_drops')
    );

    $withDrops = $entries;
    usort(
        $withDrops,
        fn($a, $b) => cls_compare_entries_by_field($a, $b, 'points_with_drops')
    );

    $toPublic = function(array $ordered, string $mode): array {
        $out = [];

        foreach ($ordered as $i => $e) {
            $out[] = [
                'position' => $i + 1,
                'display_name' => $e['display_name'],
                'gross_points' => $e['gross_points'],
                'points' => $mode === 'with_drops'
                    ? $e['points_with_drops']
                    : $e['points_without_drops'],
                'points_without_drops' => $e['points_without_drops'],
                'points_with_drops' => $e['points_with_drops'],
                'projected_drop_count' => $e['projected_drop_count'],
                'results' => $e['results'],
            ];
        }

        return $out;
    };

    $stages = [];
    for ($s = 1; $s <= CLS_NUM_STAGES; $s++) {
        $stage = $catState['stages'][(string)$s] ?? null;

        $stages[] = [
            'stage' => $s,
            'imported' => $stage !== null,
            'track_name' => $stage['track_name'] ?? null,
            'track_config' => $stage['track_config'] ?? null,
            'subsession_id' => $stage['subsession_id'] ?? null,
        ];
    }

    /*
     * "entries" é mantido por compatibilidade:
     * antes do fim = sem descartes;
     * campeonato completo = com descartes.
     */
    $officialEntries = $complete
        ? $toPublic($withDrops, 'with_drops')
        : $toPublic($withoutDrops, 'without_drops');

    return [
        'completed_heats' => $completedHeats,
        'total_heats' => CLS_NUM_STAGES * CLS_HEATS_PER_STAGE,
        'championship_complete' => $complete,
        'drop_count' => CLS_DROP_COUNT,
        'drop_projection_available' => $completedHeats > 0,
        'stages' => $stages,
        'entries' => $officialEntries,
        'entries_without_drops' => $toPublic($withoutDrops, 'without_drops'),
        'entries_with_drops' => $toPublic($withDrops, 'with_drops'),
        'count' => count($entries),
    ];
}

function cls_build_standings(): array {
    $state = cls_json_load(CLS_STATE_FILE, cls_state_default());
    $adjustments = cls_get_adjustments();

    $categories = [];

    foreach (cls_categories() as $category) {
        $catState = $state['categories'][$category] ?? ['stages' => []];
        $categories[$category] = cls_build_category_standings(
            $category,
            $catState,
            $adjustments
        );
    }

    return [
        'generated_at' => cls_now(),
        'competition' => 'Caterham Esports Brasil',
        'categories' => $categories,
    ];
}

function cls_rebuild_public(): array {
    $standings = cls_build_standings();
    cls_json_save_atomic(CLS_PUBLIC_FILE, $standings);
    return $standings;
}

function cls_import_stage(
    string $tmpFile,
    string $sourceFile,
    string $category,
    int $stage,
    bool $replace
): array {
    cls_validate_category($category);

    $raw = file_get_contents($tmpFile);
    if ($raw === false) throw new RuntimeException('Falha ao ler arquivo enviado.');

    $payload = json_decode($raw, true);
    if (!is_array($payload)) throw new RuntimeException('JSON inválido.');

    $parsed = cls_parse_eventresult($payload, $category, $stage, $sourceFile);

    $lock = fopen(CLS_LOCK_FILE, 'c+');
    if ($lock === false) throw new RuntimeException('Falha ao abrir lock.');

    try {
        flock($lock, LOCK_EX);

        $state = cls_json_load(CLS_STATE_FILE, cls_state_default());
        $key = (string)$stage;

        if (
            isset($state['categories'][$category]['stages'][$key])
            && !$replace
        ) {
            throw new RuntimeException(
                $category . ' / Etapa ' . $stage .
                ' já foi importada. Marque "substituir" para trocar.'
            );
        }

        $state['categories'][$category]['stages'][$key] = $parsed;
        ksort($state['categories'][$category]['stages'], SORT_NUMERIC);

        cls_json_save_atomic(CLS_STATE_FILE, $state);
        $standings = cls_rebuild_public();

        return [
            'category' => $category,
            'stage' => $stage,
            'subsession_id' => $parsed['subsession_id'],
            'session_name' => $parsed['session_name'],
            'track' => trim($parsed['track_name'] . ' ' . $parsed['track_config']),
            'car_names_detected' => $parsed['car_names_detected'],
            'heats_imported' => 2,
            'completed_heats' => $standings['categories'][$category]['completed_heats'],
        ];
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function cls_save_adjustment(
    string $category,
    int $stage,
    int $heat,
    string $custId,
    ?int $positionOverride,
    int $pointsDelta,
    bool $dq,
    string $note
): array {
    cls_validate_category($category);

    if ($stage < 1 || $stage > CLS_NUM_STAGES) throw new RuntimeException('Etapa inválida.');
    if ($heat < 1 || $heat > CLS_HEATS_PER_STAGE) throw new RuntimeException('Bateria inválida.');
    if ($custId === '') throw new RuntimeException('Customer ID obrigatório.');

    $lock = fopen(CLS_LOCK_FILE, 'c+');
    if ($lock === false) throw new RuntimeException('Falha ao abrir lock.');

    try {
        flock($lock, LOCK_EX);

        $state = cls_json_load(CLS_ADJUSTMENTS_FILE, ['adjustments' => []]);
        $key = cls_adjustment_key($category, $stage, $heat, $custId);

        if (
            ($positionOverride === null || $positionOverride <= 0)
            && $pointsDelta === 0
            && !$dq
            && trim($note) === ''
        ) {
            unset($state['adjustments'][$key]);
        } else {
            $state['adjustments'][$key] = [
                'category' => $category,
                'stage' => $stage,
                'heat' => $heat,
                'cust_id' => $custId,
                'position_override' => $positionOverride,
                'points_delta' => $pointsDelta,
                'dq' => $dq,
                'note' => trim($note),
                'updated_at' => cls_now(),
            ];
        }

        cls_json_save_atomic(CLS_ADJUSTMENTS_FILE, $state);
        return cls_rebuild_public();
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function cls_admin_state(): array {
    $state = cls_json_load(CLS_STATE_FILE, cls_state_default());
    $adjustments = cls_get_adjustments();
    $rows = [];

    foreach (cls_categories() as $category) {
        foreach (($state['categories'][$category]['stages'] ?? []) as $stageNo => $stage) {
            for ($heat = 1; $heat <= CLS_HEATS_PER_STAGE; $heat++) {
                $heatData = $stage['heats'][(string)$heat] ?? null;
                if (!$heatData) continue;

                foreach (($heatData['results'] ?? []) as $r) {
                    $key = cls_adjustment_key(
                        $category,
                        (int)$stageNo,
                        $heat,
                        (string)$r['cust_id']
                    );

                    $rows[] = [
                        'category' => $category,
                        'stage' => (int)$stageNo,
                        'heat' => $heat,
                        'cust_id' => (string)$r['cust_id'],
                        'display_name' => $r['display_name'],
                        'raw_position' => $r['raw_position'],
                        'laps_complete' => $r['laps_complete'],
                        'classified_75' => $r['classified_75'],
                        'server_dq' => $r['server_dq'],
                        'base_points' => $r['base_points'],
                        'adjustment' => $adjustments[$key] ?? null,
                    ];
                }
            }
        }
    }

    return [
        'state' => $state,
        'rows' => $rows,
        'standings' => cls_json_load(CLS_PUBLIC_FILE, []),
    ];
}
