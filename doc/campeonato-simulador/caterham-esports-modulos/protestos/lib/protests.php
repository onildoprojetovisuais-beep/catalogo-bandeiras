<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/config.php';

function protest_json(array $payload, int $status=200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
    exit;
}
function protest_now(): string { return gmdate('c'); }
function protest_read_json(string $path, array $default): array {
    if (!is_file($path)) return $default;
    $raw=file_get_contents($path);
    if ($raw===false || trim($raw)==='') return $default;
    $v=json_decode($raw,true);
    return is_array($v)?$v:$default;
}
function protest_write_json_atomic(string $path, array $data): void {
    $dir=dirname($path);
    if (!is_dir($dir) && !mkdir($dir,0775,true) && !is_dir($dir)) throw new RuntimeException('Falha ao criar diretório de dados.');
    $tmp=$path.'.tmp.'.bin2hex(random_bytes(5));
    $json=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
    if ($json===false || file_put_contents($tmp,$json.PHP_EOL,LOCK_EX)===false) throw new RuntimeException('Falha ao gravar dados.');
    if (!rename($tmp,$path)) { @unlink($tmp); throw new RuntimeException('Falha ao publicar dados.'); }
}
function protest_with_lock(callable $fn): mixed {
    $fp=fopen(protest_lock_file(),'c+');
    if ($fp===false) throw new RuntimeException('Falha ao abrir lock.');
    try { if (!flock($fp,LOCK_EX)) throw new RuntimeException('Falha ao bloquear dados.'); return $fn(); }
    finally { flock($fp,LOCK_UN); fclose($fp); }
}
function protest_clean(mixed $v, int $max=1000): string {
    $s=trim((string)$v);
    $s=preg_replace('/\r\n?|\n/u',"\n",$s) ?? $s;
    if (function_exists('mb_substr')) return mb_substr($s,0,$max);
    return substr($s,0,$max);
}
function protest_clean_line(mixed $v, int $max=250): string {
    $s=preg_replace('/\s+/u',' ',trim((string)$v)) ?? trim((string)$v);
    if (function_exists('mb_substr')) return mb_substr($s,0,$max);
    return substr($s,0,$max);
}
function protest_new_id(): string {
    $alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $rnd='';
    for($i=0;$i<6;$i++) $rnd.=$alphabet[random_int(0,strlen($alphabet)-1)];
    return 'CESB'.gmdate('Ymd').$rnd; // 18 caracteres, alfanumérico
}
function protest_valid_id(string $id): bool { return (bool)preg_match('/^CESB\d{8}[A-Z0-9]{6}$/',$id); }

/* ---------------- Pix BR Code estático ---------------- */
function pix_tlv(string $id, string $value): string {
    $len=strlen($value);
    if ($len>99) throw new InvalidArgumentException("Campo Pix $id excede 99 caracteres.");
    return $id.str_pad((string)$len,2,'0',STR_PAD_LEFT).$value;
}
function pix_ascii(string $s, int $max): string {
    $s=trim($s);
    if (function_exists('iconv')) {
        $x=@iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$s);
        if ($x!==false) $s=$x;
    }
    $s=preg_replace('/[^A-Za-z0-9 .\-]/','',$s) ?? $s;
    $s=preg_replace('/\s+/',' ',$s) ?? $s;
    return substr(trim($s),0,$max);
}
function pix_crc16(string $payload): string {
    $crc=0xFFFF;
    $n=strlen($payload);
    for($i=0;$i<$n;$i++) {
        $crc ^= (ord($payload[$i]) << 8);
        for($b=0;$b<8;$b++) {
            $crc = ($crc & 0x8000) ? (($crc << 1) ^ 0x1021) : ($crc << 1);
            $crc &= 0xFFFF;
        }
    }
    return strtoupper(str_pad(dechex($crc),4,'0',STR_PAD_LEFT));
}
function pix_payload_static(string $key, string $name, string $city, ?float $amount, string $txid): string {
    $key=trim($key);
    if ($key==='' || strlen($key)>77) throw new InvalidArgumentException('Chave Pix ausente ou inválida.');
    $name=pix_ascii($name,25); $city=pix_ascii($city,15);
    if ($name==='' || $city==='') throw new InvalidArgumentException('Nome/cidade do recebedor Pix não configurados.');
    if (!preg_match('/^[A-Za-z0-9]{1,25}$/',$txid) && $txid!=='***') throw new InvalidArgumentException('txid Pix inválido.');

    $mai=pix_tlv('00','br.gov.bcb.pix').pix_tlv('01',$key);
    $payload=pix_tlv('00','01')
        .pix_tlv('26',$mai)
        .pix_tlv('52','0000')
        .pix_tlv('53','986');
    if ($amount!==null && $amount>0) $payload.=pix_tlv('54',number_format($amount,2,'.',''));
    $payload.=pix_tlv('58','BR')
        .pix_tlv('59',$name)
        .pix_tlv('60',$city)
        .pix_tlv('62',pix_tlv('05',$txid));
    $payload.='6304';
    return $payload.pix_crc16($payload);
}
function protest_pix_ready(): bool { return protest_pix_key()!=='' && protest_pix_name()!=='' && protest_pix_city()!==''; }
function protest_pix_payload(string $protestId): string {
    return pix_payload_static(protest_pix_key(),protest_pix_name(),protest_pix_city(),protest_fee(),$protestId);
}

/* ---------------- Cadastro e submissão ---------------- */
function protest_registration_by_customer_id(string $cid): ?array {
    $state=protest_read_json(protest_registrations_file(),['entries'=>[]]);
    $entries=$state['entries'] ?? [];
    if (isset($entries[$cid]) && is_array($entries[$cid])) return $entries[$cid];
    if (is_array($entries)) {
        foreach($entries as $e) {
            if (!is_array($e)) continue;
            $found=(string)($e['iracing_customer_id'] ?? $e['cust_id'] ?? '');
            if ($found===$cid) return $e;
        }
    }
    return null;
}
function protest_category(mixed $v): ?string {
    $x=strtoupper(protest_clean_line($v,30));
    return match($x){'ACADEMY'=>'Academy','420R','420 R'=>'420R',default=>null};
}
function protest_state(): array {
    return protest_read_json(protest_state_file(),['version'=>1,'updated_at'=>null,'entries'=>[]]);
}
function protest_upload_error(int $code, string $label): void {
    if ($code===UPLOAD_ERR_OK) return;
    $msg=match($code){
        UPLOAD_ERR_INI_SIZE,UPLOAD_ERR_FORM_SIZE=>"$label excede o limite de upload do servidor.",
        UPLOAD_ERR_PARTIAL=>"Upload parcial de $label.",
        UPLOAD_ERR_NO_FILE=>"$label é obrigatório.",
        default=>"Falha no upload de $label."
    };
    throw new InvalidArgumentException($msg);
}
function protest_store_upload(array $file, string $protestId, string $kind): array {
    protest_upload_error((int)($file['error'] ?? UPLOAD_ERR_NO_FILE),$kind==='replay'?'Replay .rpy':'Comprovante de pagamento');
    $name=basename((string)($file['name'] ?? ''));
    $tmp=(string)($file['tmp_name'] ?? '');
    $size=(int)($file['size'] ?? 0);
    $ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));

    if ($kind==='replay') {
        if ($ext!=='rpy') throw new InvalidArgumentException('O replay deve ser um arquivo .rpy.');
        if ($size<=0 || $size>CATERHAM_PROTEST_MAX_REPLAY_BYTES) throw new InvalidArgumentException('O arquivo .rpy excede 250 MiB ou está vazio.');
        $destName='replay.rpy';
    } else {
        $allowed=['pdf','png','jpg','jpeg','webp'];
        if (!in_array($ext,$allowed,true)) throw new InvalidArgumentException('O comprovante deve ser PDF, PNG, JPG/JPEG ou WEBP.');
        if ($size<=0 || $size>CATERHAM_PROTEST_MAX_RECEIPT_BYTES) throw new InvalidArgumentException('O comprovante excede 15 MiB ou está vazio.');
        if (function_exists('finfo_open')) {
            $fi=finfo_open(FILEINFO_MIME_TYPE); $mime=$fi?finfo_file($fi,$tmp):false; if($fi)finfo_close($fi);
            $ok=['application/pdf','image/png','image/jpeg','image/webp','application/octet-stream'];
            if ($mime!==false && !in_array($mime,$ok,true)) throw new InvalidArgumentException('Tipo de arquivo do comprovante não permitido.');
        }
        $destName='comprovante.'.($ext==='jpeg'?'jpg':$ext);
    }
    $dir=protest_uploads_dir().'/'.$protestId;
    if (!is_dir($dir) && !mkdir($dir,0770,true) && !is_dir($dir)) throw new RuntimeException('Falha ao criar pasta do protesto.');
    $dest=$dir.'/'.$destName;
    if (!move_uploaded_file($tmp,$dest)) throw new RuntimeException('Falha ao armazenar arquivo enviado.');
    @chmod($dest,0660);
    return ['stored_name'=>$destName,'original_name'=>$name,'size'=>$size];
}
function protest_submit(array $post, array $files): array {
    if (!protest_pix_ready()) throw new RuntimeException('O Pix do protesto ainda não foi configurado pela Organização.');
    if (trim((string)($post['website'] ?? ''))!=='') throw new InvalidArgumentException('Submissão inválida.');

    $id=strtoupper(protest_clean_line($post['protest_id'] ?? '',30));
    if (!protest_valid_id($id)) throw new InvalidArgumentException('Identificador do protesto inválido. Atualize a página e tente novamente.');
    $name=protest_clean_line($post['full_name'] ?? '',150);
    $email=strtolower(protest_clean_line($post['email'] ?? '',180));
    $cid=preg_replace('/\D/','',(string)($post['iracing_customer_id'] ?? '')) ?? '';
    $category=protest_category($post['category'] ?? null);
    $stage=(int)($post['stage'] ?? 0); $heat=(int)($post['heat'] ?? 0); $lap=(int)($post['lap'] ?? 0);
    $cars=protest_clean($post['cars_involved'] ?? '',1000);
    $description=protest_clean($post['incident_description'] ?? '',5000);
    $basis=protest_clean($post['protest_basis'] ?? '',5000);
    $deadline=(string)($post['deadline_ack'] ?? '');

    if ($name==='' || !filter_var($email,FILTER_VALIDATE_EMAIL) || $cid==='' || !$category) throw new InvalidArgumentException('Preencha corretamente nome, e-mail, Customer ID e categoria.');
    if ($stage<1 || $stage>5 || !in_array($heat,[1,2],true) || $lap<1) throw new InvalidArgumentException('Informe etapa (1–5), bateria (1–2) e volta válidas.');
    if (strlen($cars)<2 || strlen($description)<10 || strlen($basis)<5) throw new InvalidArgumentException('Preencha carros envolvidos, descrição objetiva e fundamento do protesto.');
    if ($deadline!=='1') throw new InvalidArgumentException('É necessário confirmar ciência do prazo regulamentar de 24 horas.');

    $reg=protest_registration_by_customer_id($cid);
    if (protest_require_registered()) {
        if (!$reg) throw new InvalidArgumentException('Customer ID não encontrado entre os inscritos.');
        $regEmail=strtolower(trim((string)($reg['email'] ?? '')));
        if ($regEmail!=='' && $regEmail!==$email) throw new InvalidArgumentException('O e-mail não corresponde ao cadastro desse Customer ID.');
        $regCategory=protest_category($reg['approved_category'] ?? $reg['requested_category'] ?? null);
        if ($regCategory && $regCategory!==$category) throw new InvalidArgumentException('A categoria informada não corresponde ao cadastro do piloto.');
    }

    return protest_with_lock(function() use($id,$name,$email,$cid,$category,$stage,$heat,$lap,$cars,$description,$basis,$files){
        $state=protest_state();
        if (isset($state['entries'][$id])) throw new DomainException('Este identificador de protesto já foi utilizado. Atualize a página e tente novamente.');

        $dir=protest_uploads_dir().'/'.$id;
        try {
            $replay=protest_store_upload($files['replay_file'] ?? [],$id,'replay');
            $receipt=protest_store_upload($files['payment_receipt'] ?? [],$id,'receipt');
        } catch(Throwable $e) {
            if (is_dir($dir)) { foreach(glob($dir.'/*') ?: [] as $f) @unlink($f); @rmdir($dir); }
            throw $e;
        }

        $entry=[
            'protest_id'=>$id,
            'submitted_at'=>protest_now(),
            'full_name'=>$name,
            'email'=>$email,
            'iracing_customer_id'=>$cid,
            'category'=>$category,
            'stage'=>$stage,
            'heat'=>$heat,
            'lap'=>$lap,
            'cars_involved'=>$cars,
            'incident_description'=>$description,
            'protest_basis'=>$basis,
            'fee'=>protest_fee(),
            'pix_txid'=>$id,
            'payment_status'=>'proof_submitted_pending_verification',
            'sporting_status'=>'received',
            'admin_notes'=>'',
            'replay'=>$replay,
            'payment_receipt'=>$receipt,
        ];
        $state['entries'][$id]=$entry; $state['updated_at']=protest_now();
        protest_write_json_atomic(protest_state_file(),$state);
        return $entry;
    });
}
function protest_file_path(array $entry, string $kind): ?string {
    if (!in_array($kind,['replay','payment'],true)) return null;
    $meta=$kind==='replay' ? ($entry['replay'] ?? null) : ($entry['payment_receipt'] ?? null);
    if (!is_array($meta) || empty($meta['stored_name'])) return null;
    $path=protest_uploads_dir().'/'.$entry['protest_id'].'/'.basename((string)$meta['stored_name']);
    return is_file($path)?$path:null;
}
