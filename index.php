<?php
declare(strict_types=1);
session_start();

function env_get(string $k, ?string $d=null): ?string{
  static $env=null;
  if($env===null){
    $env=[]; $f=__DIR__.'/.env';
    if(file_exists($f)){
      foreach(file($f, FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) as $line){
        if(str_starts_with(trim($line),'#')) continue;
        $p=explode('=',$line,2); if(count($p)===2){ $env[trim($p[0])] = trim($p[1]); }
      }
    }
  }
  if(isset($_ENV[$k])) return $_ENV[$k];
  if(isset($_SERVER[$k])) return $_SERVER[$k];
  return $env[$k] ?? $d;
}
function env_bool(string $k, bool $d=false): bool{ $v=env_get($k); if($v===null) return $d; return in_array(strtolower($v),['1','true','yes','on'],true); }
function storage_path(): string{ $p=rtrim(env_get('STORAGE_PATH','data'),'/'); if(!is_dir($p)) mkdir($p,0775,true); if(!is_dir("$p/meetings")) mkdir("$p/meetings",0775,true); return $p; }
function meeting_dir(string $id): string{ $b=storage_path()."/meetings/$id"; if(!is_dir($b)) mkdir($b,0775,true); if(!is_dir("$b/audio")) mkdir("$b/audio",0775,true); if(!is_dir("$b/versions")) mkdir("$b/versions",0775,true); return $b; }
function json_out(array $p, int $s=200){ http_response_code($s); header('Content-Type: application/json; charset=utf-8'); echo json_encode($p, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }

// Error logging functions
function logError($meetingId, $error, $context = []) {
  $dir = meeting_dir($meetingId);
  $errorFile = "$dir/error.txt";
  
  $timestamp = date('Y-m-d H:i:s');
  $contextStr = !empty($context) ? ' | Context: ' . json_encode($context, JSON_UNESCAPED_UNICODE) : '';
  $logEntry = "[$timestamp] $error$contextStr\n";
  
  file_put_contents($errorFile, $logEntry, FILE_APPEND | LOCK_EX);
  error_log("Meeting $meetingId error: $error");
}

function logApiError($meetingId, $error, $status = null, $raw = null) {
  $context = [];
  if ($status) $context['status'] = $status;
  if ($raw) $context['raw'] = substr($raw, 0, 500); // Limit raw response size
  
  logError($meetingId, $error, $context);
}

// Save agenda to file
function saveAgenda($meetingId, $agendaContent) {
  if (!$agendaContent) return false;
  
  $dir = meeting_dir($meetingId);
  $file = "$dir/agenda.md";
  file_put_contents($file, $agendaContent);
  error_log("Saved agenda to: $file");
  return true;
}

// Ensure all meeting files are saved in correct structure
function saveMeetingFile($meetingId, $filename, $content, $subdir = '') {
  $dir = meeting_dir($meetingId);
  if ($subdir) {
    $dir .= "/$subdir";
    if (!is_dir($dir)) mkdir($dir, 0775, true);
  }
  
  $filepath = "$dir/$filename";
  file_put_contents($filepath, $content);
  error_log("Saved meeting file: $filepath");
  return $filepath;
}

// Helper function to suggest format conversion
function suggestFormatConversion($extension) {
  $conversionMap = [
    'aac' => 'mp3',
    'aiff' => 'wav', 
    'au' => 'wav',
    'ra' => 'wav',
    'wma' => 'mp3',
    'm4v' => 'mp4',
    'mov' => 'mp4',
    'avi' => 'mp4'
  ];
  
  return $conversionMap[strtolower($extension)] ?? null;
}

// Helper function to detect and fix .dat files that are actually WebM
function fixDatFileIfWebM($filePath) {
  if (!file_exists($filePath)) return false;
  
  // Read first few bytes to detect WebM format
  $handle = fopen($filePath, 'rb');
  if (!$handle) return false;
  
  $header = fread($handle, 4);
  fclose($handle);
  
  // Check for WebM/EBML header (1A 45 DF A3)
  if (strlen($header) >= 4 && 
      ord($header[0]) === 0x1A && 
      ord($header[1]) === 0x45 && 
      ord($header[2]) === 0xDF && 
      ord($header[3]) === 0xA3) {
    
    // This is actually a WebM file, rename it
    $newPath = preg_replace('/\.dat$/', '.webm', $filePath);
    if (rename($filePath, $newPath)) {
      error_log("Converted .dat file to .webm: $filePath -> $newPath");
      return $newPath;
    }
  }
  
  return false;
}

$action = $_POST['action'] ?? $_GET['action'] ?? null;

// Create new meeting
if($action==='create_meeting'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  
  $meetingId = 'meeting_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3));
  $dir = meeting_dir($meetingId);
  
  // Create initial meeting state
  $initialState = [
    'meetingId' => $meetingId,
    'created' => date('Y-m-d H:i:s'),
    'agenda' => '',
    'transcript' => '',
    'filled' => '',
    'currentStep' => 'agenda',
    'uploaded' => null
  ];
  
  file_put_contents("$dir/meeting_state.json", json_encode($initialState, JSON_UNESCAPED_UNICODE));
  
  json_out(['ok'=>true,'meetingId'=>$meetingId,'message'=>'Meeting created']);
}

// Load existing meeting
if($action==='load_meeting'){
  $meetingId=$_GET['meetingId']??null;
  if(!$meetingId) {
    json_out(['ok'=>false,'error'=>'meetingId required'],400);
  }
  
  try {
    $dir = meeting_dir($meetingId);
    $stateFile = "$dir/meeting_state.json";
    
    if(!file_exists($stateFile)){
      $errorMsg = 'Meeting not found: ' . $meetingId;
      logError($meetingId, $errorMsg, ['state_file' => $stateFile]);
      json_out(['ok'=>false,'error'=>$errorMsg],404);
    }
    
    $stateContent = file_get_contents($stateFile);
    if($stateContent === false) {
      $errorMsg = 'Could not read meeting state file';
      logError($meetingId, $errorMsg, ['state_file' => $stateFile]);
      json_out(['ok'=>false,'error'=>$errorMsg],500);
    }
    
    $state = json_decode($stateContent, true);
    if($state === null) {
      $errorMsg = 'Invalid JSON in meeting state file';
      logError($meetingId, $errorMsg, ['state_file' => $stateFile, 'content' => substr($stateContent, 0, 200)]);
      json_out(['ok'=>false,'error'=>$errorMsg],500);
    }
    
    // Load additional data from files
    $state['agenda'] = file_exists("$dir/agenda.md") ? file_get_contents("$dir/agenda.md") : '';
    $state['transcript'] = file_exists("$dir/transcript.txt") ? file_get_contents("$dir/transcript.txt") : '';
    $state['filled'] = file_exists("$dir/filled.md") ? file_get_contents("$dir/filled.md") : '';
    $state['chatDialog'] = file_exists("$dir/chat_dialog.json") ? file_get_contents("$dir/chat_dialog.json") : '';
    
    // Load uploaded file info
    $audioFiles = glob("$dir/audio/*");
    if(!empty($audioFiles)){
      $audioFile = $audioFiles[0]; // Get first audio file
      $state['uploaded'] = [
        'path' => $audioFile,
        'filename' => basename($audioFile),
        'size' => filesize($audioFile),
        'type' => mime_content_type($audioFile)
      ];
    }
    
    json_out(['ok'=>true,'meeting'=>$state]);
    
  } catch (Exception $e) {
    $errorMsg = 'Error loading meeting: ' . $e->getMessage();
    logError($meetingId, $errorMsg, ['exception' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
    json_out(['ok'=>false,'error'=>$errorMsg],500);
  }
}

// List existing meetings
if($action==='list_meetings'){
  $meetingsDir = storage_path() . '/meetings';
  $meetings = [];
  
  if(is_dir($meetingsDir)){
    $dirs = glob("$meetingsDir/*", GLOB_ONLYDIR);
    foreach($dirs as $dir){
      $meetingId = basename($dir);
      $stateFile = "$dir/meeting_state.json";
      
      if(file_exists($stateFile)){
        $state = json_decode(file_get_contents($stateFile), true);
        
        // Get created timestamp
        $created = filemtime($dir);
        if(isset($state['created'])){
          $createdParsed = strtotime($state['created']);
          if($createdParsed !== false){
            $created = $createdParsed;
          }
        }
        
        // Get modified timestamp from directory or state file
        $modified = filemtime($stateFile);
        
        $meetings[] = [
          'id' => $meetingId,
          'created' => $created,
          'modified' => $modified,
          'currentStep' => $state['currentStep'] ?? 'agenda',
          'hasTranscript' => file_exists("$dir/transcript.txt"),
          'hasFilled' => file_exists("$dir/filled.md"),
          'hasAgenda' => file_exists("$dir/agenda.md"),
          'hasAudio' => !empty(glob("$dir/audio/*"))
        ];
      }
    }
  }
  
  // Sort by modification date (newest first)
  usort($meetings, function($a, $b) {
    return $b['modified'] - $a['modified'];
  });
  
  json_out(['ok'=>true,'meetings'=>$meetings]);
}

// Save agenda action
if($action==='save_agenda'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  $meetingId=$_POST['meetingId']??null; $agendaContent=$_POST['agendaContent']??null;
  if(!$meetingId||!$agendaContent) json_out(['ok'=>false,'error'=>'meetingId and agendaContent required'],400);
  
  if(saveAgenda($meetingId, $agendaContent)){
    json_out(['ok'=>true,'message'=>'Agenda saved']);
  } else {
    json_out(['ok'=>false,'error'=>'Failed to save agenda'],500);
  }
}

if($action==='save_chat'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  $meetingId=$_POST['meetingId']??null; $chatData=$_POST['chatData']??null;
  if(!$meetingId||!$chatData) json_out(['ok'=>false,'error'=>'meetingId and chatData required'],400);
  
  $dir=meeting_dir($meetingId);
  $file="$dir/chat_dialog.json";
  
  if(file_put_contents($file, $chatData)){
    error_log("Saved chat dialog to: $file");
    json_out(['ok'=>true,'message'=>'Chat dialog saved']);
  } else {
    json_out(['ok'=>false,'error'=>'Failed to save chat dialog'],500);
  }
}

// Save transcript
if($action==='save_transcript'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  $meetingId=$_POST['meetingId']??null; $transcriptContent=$_POST['transcriptContent']??null;
  if(!$meetingId) json_out(['ok'=>false,'error'=>'meetingId required'],400);
  
  $dir=meeting_dir($meetingId);
  $file="$dir/transcript.txt";
  
  // Create backup of old transcript if it exists
  if(file_exists($file)){
    $backupDir = "$dir/versions";
    if(!is_dir($backupDir)) mkdir($backupDir, 0775, true);
    $backupFile = "$backupDir/transcript_" . date('Ymd_His') . '.txt';
    copy($file, $backupFile);
    error_log("Backed up old transcript to: $backupFile");
  }
  
  if(file_put_contents($file, $transcriptContent ?? '')){
    error_log("Saved transcript to: $file");
    json_out(['ok'=>true,'message'=>'Transcript saved']);
  } else {
    json_out(['ok'=>false,'error'=>'Failed to save transcript'],500);
  }
}

if($action==='upload'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  $meetingId=$_POST['meetingId']??null;
  if(!$meetingId) json_out(['ok'=>false,'error'=>'meetingId required'],400);
  if(!isset($_FILES['audio'])) json_out(['ok'=>false,'error'=>'audio required'],400);
  if($_FILES['audio']['size']>100*1024*1024) json_out(['ok'=>false,'error'=>'file too large'],400);
  
  // Ensure meeting directory and audio subdirectory exist
  $meetingDir = meeting_dir($meetingId);
  $audioDir = "$meetingDir/audio";
  
  // Double-check audio directory exists
  if(!is_dir($audioDir)){
    if(!mkdir($audioDir, 0775, true)){
      error_log("Failed to create audio directory: $audioDir");
      json_out(['ok'=>false,'error'=>'Failed to create audio directory'],500);
    }
  }
  
  // Get MIME type from both uploaded file and form data
  $formMime = $_FILES['audio']['type'] ?? '';
  $detectedMime = mime_content_type($_FILES['audio']['tmp_name']);
  $mime = $formMime ?: $detectedMime;
  
  // Determine extension based on MIME type and filename
  $originalName = $_FILES['audio']['name'] ?? '';
  $originalExt = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
  
  // Log for debugging
  error_log("Upload - meetingId: $meetingId");
  error_log("Upload - audioDir: $audioDir");
  error_log("Upload - originalName: $originalName");
  error_log("Upload - formMime: $formMime, detectedMime: $detectedMime, finalMime: $mime");
  error_log("Upload - originalExt: $originalExt");
  
  $ext = match($mime){
    'audio/webm', 'audio/webm;codecs=opus' => 'webm',
    'audio/ogg' => 'ogg', 
    'audio/mpeg', 'audio/mp3' => 'mp3',
    'audio/wav', 'audio/x-wav' => 'wav',
    'audio/mp4', 'video/mp4' => 'mp4',
    'audio/flac' => 'flac',
    'audio/m4a' => 'm4a',
    default => $originalExt ?: 'webm' // Default to webm for browser recordings
  };
  
  $name='audio_'.date('Ymd_His').'_'.bin2hex(random_bytes(3)).'.'.$ext;
  $target="$audioDir/$name";
  
  error_log("Upload - final extension: $ext");
  error_log("Upload - target path: $target");
  
  if(!move_uploaded_file($_FILES['audio']['tmp_name'],$target)){
    $errorMsg = 'move_uploaded_file failed';
    logError($meetingId, $errorMsg, ['target' => $target, 'file_size' => $_FILES['audio']['size']]);
    json_out(['ok'=>false,'error'=>$errorMsg],500);
  }
  
  error_log("Upload successful - file saved to: $target");
  json_out(['ok'=>true,'path'=>$target,'filename'=>$name,'mime'=>$mime]);
}

if($action==='transcribe'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  
  $meetingId=$_POST['meetingId']??null; 
  $path=$_POST['path']??null; 
  $lang=$_POST['lang']??env_get('WHISPER_LANGUAGE','sv');
  
  if(!$meetingId||!$path) json_out(['ok'=>false,'error'=>'meetingId and path required'],400);
  
  // Use settings from env only
  $apiKey = env_get('OPENAI_API_KEY');
  $apiUrl = env_get('OPENAI_BASE_URL', 'https://api.openai.com');
  $model = env_get('WHISPER_MODEL', 'whisper-1');
  
  // Debug info
  error_log("Transcription request: meetingId=$meetingId, path=$path, lang=$lang");
  error_log("API settings: key=" . ($apiKey ? 'SET' : 'NOT SET') . ", url=$apiUrl, model=$model");
  
  // Check if .env file exists
  if (!file_exists(__DIR__ . '/.env')) {
    error_log("No .env file found, using mock mode");
    $mock = true;
  } else {
    $mock = env_bool('MOCK_MODE',false) || !$apiKey;
  }
  
  if($mock){ 
    $text="Detta är ett EXEMPELTRANSKRIPT (mock) på svenska. Här nämns beslut, åtgärder och nästa steg.";
    error_log("Using mock transcription");
  }
  else{
    if(!file_exists($path)) {
      error_log("Audio file not found: $path");
      json_out(['ok'=>false,'error'=>'Audio file not found: ' . $path],404);
    }
    
    // Check if this is a .dat file that's actually WebM and fix it
    $fixedPath = fixDatFileIfWebM($path);
    if ($fixedPath) {
      $path = $fixedPath;
      error_log("Using fixed path: $path");
    }
    
    // Validate file format before sending to API
    $allowedExtensions = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
    $fileExtension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    
    if(!in_array($fileExtension, $allowedExtensions)) {
      $suggestedFormat = suggestFormatConversion($fileExtension);
      $errorMessage = 'Ogiltigt filformat: ' . strtoupper($fileExtension) . '. Stödda format: ' . implode(', ', array_map('strtoupper', $allowedExtensions));
      
      if($suggestedFormat) {
        $errorMessage .= '. Försök konvertera till ' . strtoupper($suggestedFormat) . ' format.';
      }
      
      logError($meetingId, $errorMessage, ['file_extension' => $fileExtension, 'file_path' => $path]);
      json_out(['ok'=>false,'error'=>$errorMessage],400);
    }
    
    try {
      $base=rtrim($apiUrl,'/'); 
      $url=$base.'/v1/audio/transcriptions'; 
      $cfile=new CURLFile($path);
      $post=['file'=>$cfile,'model'=>$model,'language'=>$lang];
      
      $ch=curl_init($url);
      curl_setopt_array($ch,[
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_POST=>true,
        CURLOPT_POSTFIELDS=>$post,
        CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$apiKey],
        CURLOPT_TIMEOUT=>300,
        CURLOPT_CONNECTTIMEOUT=>30
      ]);
      
      $res=curl_exec($ch); 
      if($res===false){
        $err=curl_error($ch); 
        curl_close($ch); 
        $errorMsg = 'Network error: ' . $err;
        logApiError($meetingId, $errorMsg);
        json_out(['ok'=>false,'error'=>$errorMsg],500);
      }
      
      $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); 
      curl_close($ch);
      
      error_log("API response status: $status");
      error_log("API response body: " . substr($res, 0, 500));
      
      if($status >= 400){
        $j = json_decode($res, true);
        $errorMessage = 'API error (status: ' . $status . ')';
        
        if($status === 429) {
          $errorMessage = 'Rate limit nådd. Försök igen om några minuter. (Status: 429)';
          if(isset($j['error']['message'])) {
            $errorMessage .= ' - ' . $j['error']['message'];
          }
        } elseif(isset($j['error']['message'])) {
          $errorMessage = $j['error']['message'];
          
          // Handle specific file format errors
          if(strpos($errorMessage, 'Invalid file format') !== false || strpos($errorMessage, 'Unsupported file format') !== false) {
            $errorMessage = 'Ogiltigt filformat. Stödda format: FLAC, M4A, MP3, MP4, MPEG, MPGA, OGA, OGG, WAV, WebM';
          }
        }
        
        logApiError($meetingId, $errorMessage, $status, $res);
        json_out(['ok'=>false,'error'=>$errorMessage,'status'=>$status,'raw'=>$res],500);
      }
      
      $j=json_decode($res,true); 
      if(!is_array($j)) {
        $errorMsg = 'Invalid API response';
        logApiError($meetingId, $errorMsg, null, $res);
        json_out(['ok'=>false,'error'=>$errorMsg,'raw'=>$res],500);
      }
      
      $text=$j['text']??'';
      if(empty($text)) {
        $errorMsg = 'Empty transcription result';
        logError($meetingId, $errorMsg);
        json_out(['ok'=>false,'error'=>$errorMsg],500);
      }
      
      error_log("Transcription successful, length: " . strlen($text));
      
    } catch (Exception $e) {
      $errorMsg = 'Transcription failed: ' . $e->getMessage();
      logError($meetingId, $errorMsg, ['exception' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
      json_out(['ok'=>false,'error'=>$errorMsg],500);
    }
  }
  
  $dir=meeting_dir($meetingId);
  $transcriptFile = "$dir/transcript.txt";
  
  // Check if we should append or replace
  $append = isset($_POST['append']) && $_POST['append'] === 'true';
  
  if($append && file_exists($transcriptFile)){
    // Append to existing transcript with separator
    $existingTranscript = file_get_contents($transcriptFile);
    $filename = $_POST['filename'] ?? 'unknown';
    $separator = "\n\n--- Transkribering från: $filename ---\n\n";
    $newTranscript = $existingTranscript . $separator . $text;
    file_put_contents($transcriptFile, $newTranscript);
    json_out(['ok'=>true,'transcript'=>$newTranscript]);
  } else {
    // Replace transcript
    file_put_contents($transcriptFile, $text);
    json_out(['ok'=>true,'transcript'=>$text]);
  }
}

if($action==='llm_fill'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  $meetingId=$_POST['meetingId']??null; $templateMarkdown=$_POST['templateMarkdown']??null;
  if(!$meetingId||!$templateMarkdown) json_out(['ok'=>false,'error'=>'meetingId and templateMarkdown required'],400);
  $dir=meeting_dir($meetingId); $transcript=file_exists("$dir/transcript.txt")?file_get_contents("$dir/transcript.txt"):'';
  $systemPrompt=$_POST['systemPrompt']??'Du är en assistent...'; $taskPrompt=$_POST['taskPrompt']??'Fyll i mallen baserat på transkriptet.';
  
  // Use settings from env only
  $apiKey = env_get('LLM_API_KEY');
  $apiUrl = env_get('LLM_BASE_URL', 'https://api.openai.com');
  $model = env_get('LLM_MODEL', 'gpt-4o-mini');
  $temperature = floatval(env_get('LLM_TEMPERATURE', '0.2'));
  
  // Check if .env file exists
  if (!file_exists(__DIR__ . '/.env')) {
    $mock = true;
  } else {
    $mock = env_bool('MOCK_MODE',false) || !$apiKey;
  }
  if($mock){
    $filled=$templateMarkdown;
    $filled=preg_replace('/(?<=## Sammanfattning)(.*?)(?=^## |\\Z)/ms',"\n- Sammanfattning (mock) baserad på transkript\n",$filled);
    $filled=preg_replace('/(?<=## Beslut)(.*?)(?=^## |\\Z)/ms',"\n- Beslut: Demo-beslut\n",$filled);
    $filled=preg_replace('/(?<=## Åtgärder)(.*?)(?=^## |\\Z)/ms',"\n- [ ] Demo-åtgärd; Ansvarig: Anna; Deadline: 2025-09-01\n",$filled);
    $filled=preg_replace('/(?<=## Risker)(.*?)(?=^## |\\Z)/ms',"\n- Demo-risk\n",$filled);
    $filled=preg_replace('/(?<=## Nästa steg)(.*?)(?=^## |\\Z)/ms',"\n- Boka uppföljning (demo)\n",$filled);
  } else {
    $base=rtrim($apiUrl,'/'); $url=$base.'/v1/chat/completions';
    $payload=['model'=>$model,'temperature'=>$temperature,'messages'=>[['role'=>'system','content'=>$systemPrompt],['role'=>'user','content'=>$taskPrompt."\n\nMALL:\n".$templateMarkdown."\n\nTRANSKRIPT:\n".$transcript]]];
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$apiKey,'Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    $res=curl_exec($ch); if($res===false){$err=curl_error($ch); curl_close($ch); json_out(['ok'=>false,'error'=>$err],500);}
    $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    $j=json_decode($res,true); if($status>=400||!isset($j['choices'][0]['message']['content'])) json_out(['ok'=>false,'error'=>'LLM error','raw'=>$res],500);
    $filled=$j['choices'][0]['message']['content'];
  }
  $file="$dir/filled.md"; if(file_exists($file)) @copy($file,$dir.'/versions/filled_'.date('Ymd_His').'.md'); file_put_contents($file,$filled);
  json_out(['ok'=>true,'filledMarkdown'=>$filled]);
}

if($action==='llm_chat'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  $meetingId=$_POST['meetingId']??null; $messages=$_POST['messages']??null;
  if(!$meetingId||!$messages) json_out(['ok'=>false,'error'=>'meetingId and messages required'],400);
  
  // Use settings from env only, but allow model and temperature override from form
  $apiKey = env_get('LLM_API_KEY');
  $apiUrl = env_get('LLM_BASE_URL', 'https://api.openai.com');
  $model = $_POST['model'] ?? env_get('LLM_MODEL', 'gpt-4o-mini');
  $temperature = floatval($_POST['temperature'] ?? env_get('LLM_TEMPERATURE', '0.2'));
  
  // Check if .env file exists
  if (!file_exists(__DIR__ . '/.env')) {
    $mock = true;
  } else {
    $mock = env_bool('MOCK_MODE',false) || !$apiKey;
  }
  if($mock){ 
    $response = "Detta är ett mock-svar från LLM. I verkligheten skulle jag hjälpa dig att fylla i mallen baserat på transkriptet.";
    $filledTemplate = null;
  } else {
    $base=rtrim($apiUrl,'/'); $url=$base.'/v1/chat/completions';
    $messagesArray = json_decode($messages, true);
    $payload=['model'=>$model,'temperature'=>$temperature,'messages'=>$messagesArray];
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$apiKey,'Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    $res=curl_exec($ch); 
    if($res===false){
      $err=curl_error($ch); 
      curl_close($ch); 
      $errorMsg = 'LLM network error: ' . $err;
      logApiError($meetingId, $errorMsg);
      json_out(['ok'=>false,'error'=>$errorMsg],500);
    }
    $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); 
    curl_close($ch);
    $j=json_decode($res,true); 
    if($status>=400||!isset($j['choices'][0]['message']['content'])) {
      $errorMsg = 'LLM API error (status: ' . $status . ')';
      logApiError($meetingId, $errorMsg, $status, $res);
      json_out(['ok'=>false,'error'=>$errorMsg,'raw'=>$res],500);
    }
    $response = $j['choices'][0]['message']['content'];
    
    // The entire response should be treated as the filled template
    $filledTemplate = $response;
    
    // Save to file
    $dir = meeting_dir($meetingId);
    $file = "$dir/filled.md";
    if (file_exists($file)) @copy($file, $dir.'/versions/filled_'.date('Ymd_His').'.md');
    file_put_contents($file, $filledTemplate);
  }
  
  json_out(['ok'=>true,'response'=>$response,'filledTemplate'=>$filledTemplate]);
}

// List all audio files for a meeting
if($action==='list_audio_files'){
  $meetingId=$_GET['meetingId']??null;
  if(!$meetingId) json_out(['ok'=>false,'error'=>'meetingId required'],400);
  
  $dir=meeting_dir($meetingId);
  $audioDir="$dir/audio";
  $audioFiles = [];
  
  if(is_dir($audioDir)){
    $files = glob("$audioDir/*");
    foreach($files as $file){
      if(is_file($file)){
        $audioFiles[] = [
          'path' => $file,
          'filename' => basename($file),
          'size' => filesize($file),
          'mime' => mime_content_type($file),
          'uploaded' => filemtime($file)
        ];
      }
    }
  }
  
  json_out(['ok'=>true,'files'=>$audioFiles]);
}

if($action==='download_audio'){
  $meetingId=$_GET['meetingId']??null;
  $filename=$_GET['filename']??null;
  if(!$meetingId){ http_response_code(400); echo "meetingId required"; exit; }
  
  $dir=meeting_dir($meetingId);
  $audioDir="$dir/audio";
  
  if(!is_dir($audioDir)){
    http_response_code(404); echo "No audio directory found"; exit;
  }
  
  // If filename is specified, download that specific file
  if($filename){
    $audioFile = "$audioDir/$filename";
    if(!file_exists($audioFile)){
      http_response_code(404); echo "Audio file not found"; exit;
    }
  } else {
    // Otherwise download first file (backwards compatibility)
    $audioFiles = glob("$audioDir/*");
    if(empty($audioFiles)){
      http_response_code(404); echo "No audio files found"; exit;
    }
    $audioFile = $audioFiles[0];
    $filename = basename($audioFile);
  }
  
  $mimeType = mime_content_type($audioFile);
  
  header('Content-Type: ' . $mimeType);
  header('Content-Disposition: attachment; filename="' . $filename . '"');
  header('Content-Length: ' . filesize($audioFile));
  
  readfile($audioFile);
  exit;
}

if($action==='export'){
  $meetingId=$_GET['meetingId']??null; $format=$_GET['format']??'md'; $filename=$_GET['filename']??'filled_'.$meetingId;
  if(!$meetingId){ http_response_code(400); echo "meetingId required"; exit; }
  $dir=meeting_dir($meetingId); $filled=file_exists("$dir/filled.md")?file_get_contents("$dir/filled.md"):null;
  if(!$filled){ http_response_code(404); echo "No filled document"; exit; }
  if($format==='md'){ header('Content-Type: text/markdown; charset=utf-8'); header('Content-Disposition: attachment; filename="'.$filename.'.md"'); echo $filled; exit; }
  if($format==='json'){
    $lines=preg_split('/\R/',$filled); $data=[]; $current=null;
    foreach($lines as $line){ if(preg_match('/^##\s+(.*)$/',$line,$m)){ $current=trim($m[1]); $data[$current]=''; } elseif($current!==null){ $data[$current].=($data[$current]?"\n":"").$line; } }
    header('Content-Type: application/json; charset=utf-8'); header('Content-Disposition: attachment; filename="'.$filename.'.json"'); echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT); exit;
  }
  http_response_code(400); echo "Unsupported format"; exit;
}

// Export all data as ZIP
if($action==='export_all'){
  $meetingId=$_GET['meetingId']??null; $filename=$_GET['filename']??'motesdata_'.date('Y-m-d');
  if(!$meetingId){ http_response_code(400); echo "meetingId required"; exit; }
  
  $dir=meeting_dir($meetingId);
  if(!is_dir($dir)){ http_response_code(404); echo "Meeting not found"; exit; }
  
  // Create ZIP file
  $zipFile = tempnam(sys_get_temp_dir(), 'export_');
  $zip = new ZipArchive();
  if($zip->open($zipFile, ZipArchive::CREATE) !== TRUE){
    http_response_code(500); echo "Cannot create ZIP file"; exit;
  }
  
  // Recursive function to add all files and subdirectories
  $addDirectoryToZip = function($source, $zipPath = '') use (&$addDirectoryToZip, $zip, $dir) {
    $iterator = new RecursiveIteratorIterator(
      new RecursiveDirectoryIterator($source, RecursiveDirectoryIterator::SKIP_DOTS),
      RecursiveIteratorIterator::SELF_FIRST
    );
    
    foreach($iterator as $item) {
      $itemPath = $item->getPathname();
      $relativePath = substr($itemPath, strlen($dir) + 1);
      
      // Replace directory separators with forward slash for cross-platform compatibility
      $relativePath = str_replace('\\', '/', $relativePath);
      
      if($item->isDir()) {
        // Add directory to zip
        $zip->addEmptyDir($relativePath);
      } else {
        // Add file to zip
        $zip->addFile($itemPath, $relativePath);
      }
    }
  };
  
  // Add all files and subdirectories from meeting directory
  $addDirectoryToZip($dir);
  
  $zip->close();
  
  header('Content-Type: application/zip');
  header('Content-Disposition: attachment; filename="'.$filename.'.zip"');
  header('Content-Length: ' . filesize($zipFile));
  readfile($zipFile);
  unlink($zipFile);
  exit;
}

// Export as Word document (HTML format that Word can open)
if($action==='export_word'){
  $meetingId=$_GET['meetingId']??null; $filename=$_GET['filename']??'motesmall_'.date('Y-m-d');
  if(!$meetingId){ http_response_code(400); echo "meetingId required"; exit; }
  
  $dir=meeting_dir($meetingId);
  $filled=file_exists("$dir/filled.md")?file_get_contents("$dir/filled.md"):null;
  if(!$filled){ http_response_code(404); echo "No filled document"; exit; }
  
  // Convert markdown to HTML with better Word compatibility
  $html = '<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<meta name="Originator" content="Microsoft Word 15">
<title>Mötesmall</title>
<style>
body { font-family: "Calibri", sans-serif; font-size: 11pt; line-height: 1.15; margin: 1in; }
h1 { font-size: 18pt; font-weight: bold; color: #2F5496; margin-top: 12pt; margin-bottom: 6pt; }
h2 { font-size: 14pt; font-weight: bold; color: #2F5496; margin-top: 12pt; margin-bottom: 6pt; }
h3 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
p { margin-bottom: 6pt; }
ul, ol { margin-bottom: 6pt; }
li { margin-bottom: 3pt; }
strong { font-weight: bold; }
em { font-style: italic; }
</style>
</head>
<body>';
  
  // Better markdown to HTML conversion
  $lines = explode("\n", $filled);
  $inList = false;
  
  foreach($lines as $line) {
    $line = trim($line);
    
    if(empty($line)) {
      if($inList) {
        $html .= '</ul>';
        $inList = false;
      }
      $html .= '<p>&nbsp;</p>';
      continue;
    }
    
    if(preg_match('/^# (.*)$/', $line, $matches)) {
      if($inList) {
        $html .= '</ul>';
        $inList = false;
      }
      $html .= '<h1>' . htmlspecialchars($matches[1]) . '</h1>';
    } elseif(preg_match('/^## (.*)$/', $line, $matches)) {
      if($inList) {
        $html .= '</ul>';
        $inList = false;
      }
      $html .= '<h2>' . htmlspecialchars($matches[1]) . '</h2>';
    } elseif(preg_match('/^### (.*)$/', $line, $matches)) {
      if($inList) {
        $html .= '</ul>';
        $inList = false;
      }
      $html .= '<h3>' . htmlspecialchars($matches[1]) . '</h3>';
    } elseif(preg_match('/^- (.*)$/', $line, $matches)) {
      if(!$inList) {
        $html .= '<ul>';
        $inList = true;
      }
      $content = htmlspecialchars($matches[1]);
      $content = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $content);
      $content = preg_replace('/\*(.*?)\*/', '<em>$1</em>', $content);
      $html .= '<li>' . $content . '</li>';
    } else {
      if($inList) {
        $html .= '</ul>';
        $inList = false;
      }
      $content = htmlspecialchars($line);
      $content = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $content);
      $content = preg_replace('/\*(.*?)\*/', '<em>$1</em>', $content);
      $html .= '<p>' . $content . '</p>';
    }
  }
  
  if($inList) {
    $html .= '</ul>';
  }
  
  $html .= '</body></html>';
  
  // Export as HTML (Word can open HTML files)
  header('Content-Type: application/vnd.ms-word; charset=utf-8');
  header('Content-Disposition: attachment; filename="'.$filename.'.doc"');
  echo $html;
  exit;
}


// Rename meeting directory
if($action==='rename_meeting'){
  if($_SERVER['REQUEST_METHOD']!=='POST') json_out(['ok'=>false,'error'=>'Method not allowed'],405);
  $oldMeetingId=$_POST['oldMeetingId']??null;
  $newMeetingId=$_POST['newMeetingId']??null;
  if(!$oldMeetingId||!$newMeetingId) json_out(['ok'=>false,'error'=>'oldMeetingId and newMeetingId required'],400);
  
  // Validate new meeting ID (alphanumeric, dash, underscore only)
  if(!preg_match('/^[a-zA-Z0-9_-]+$/', $newMeetingId)){
    json_out(['ok'=>false,'error'=>'Ogiltigt namn. Använd endast bokstäver, siffror, bindestreck och understreck.'],400);
  }
  
  $oldDir = storage_path()."/meetings/$oldMeetingId";
  $newDir = storage_path()."/meetings/$newMeetingId";
  
  // Check if old directory exists
  if(!is_dir($oldDir)){
    json_out(['ok'=>false,'error'=>'Möte hittades inte'],404);
  }
  
  // Check if new directory already exists
  if(is_dir($newDir)){
    json_out(['ok'=>false,'error'=>'Ett möte med detta namn finns redan'],400);
  }
  
  // Rename directory
  if(rename($oldDir, $newDir)){
    // Update meeting state file
    $stateFile = "$newDir/meeting_state.json";
    if(file_exists($stateFile)){
      $state = json_decode(file_get_contents($stateFile), true) ?? [];
      $state['meetingId'] = $newMeetingId;
      $state['oldMeetingId'] = $oldMeetingId;
      $state['renamed'] = date('c');
      file_put_contents($stateFile, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
    
    error_log("Renamed meeting: $oldMeetingId -> $newMeetingId");
    json_out(['ok'=>true,'newMeetingId'=>$newMeetingId,'message'=>'Möte bytte namn']);
  } else {
    error_log("Failed to rename meeting: $oldMeetingId -> $newMeetingId");
    json_out(['ok'=>false,'error'=>'Kunde inte byta namn på mötet'],500);
  }
}

// Save meeting state
if($action==='save_meeting_state'){
  $input = json_decode(file_get_contents('php://input'), true);
  if(!$input || !isset($input['meetingId'])){
    http_response_code(400); echo "Invalid input"; exit;
  }
  
  $meetingId = $input['meetingId'];
  $dir = meeting_dir($meetingId);
  
  // Create meeting directory if it doesn't exist
  if(!is_dir($dir)){
    mkdir($dir, 0755, true);
  }
  
  // Save meeting state as JSON
  $stateFile = "$dir/meeting_state.json";
  $meetingState = [
    'meetingId' => $meetingId,
    'currentStep' => $input['currentStep'] ?? 'agenda',
    'agenda' => $input['agenda'] ?? '',
    'transcript' => $input['transcript'] ?? '',
    'filled' => $input['filled'] ?? '',
    'settings' => $input['settings'] ?? [],
    'timestamp' => $input['timestamp'] ?? date('c'),
    'lastSaved' => date('c')
  ];
  
  file_put_contents($stateFile, json_encode($meetingState, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  
  json_out(['ok'=>true,'message'=>'Meeting state saved']);
}

// Load meeting state
if($action==='load_meeting_state'){
  $meetingId = $_GET['meetingId'] ?? null;
  if(!$meetingId){
    http_response_code(400); echo "meetingId required"; exit;
  }
  
  $dir = meeting_dir($meetingId);
  $stateFile = "$dir/meeting_state.json";
  
  if(file_exists($stateFile)){
    $meetingState = json_decode(file_get_contents($stateFile), true);
    if($meetingState){
      json_out(['ok'=>true,'meetingState'=>$meetingState]);
    } else {
      json_out(['ok'=>false,'error'=>'Invalid meeting state file']);
    }
  } else {
    json_out(['ok'=>false,'error'=>'No meeting state found']);
  }
}

// Load transcript from meeting folder
if($action==='load_transcript'){
  $meetingId = $_GET['meetingId'] ?? null;
  if(!$meetingId){
    http_response_code(400); echo "meetingId required"; exit;
  }
  
  $dir = meeting_dir($meetingId);
  $transcriptFile = "$dir/transcript.txt";
  
  if(file_exists($transcriptFile)){
    $transcript = file_get_contents($transcriptFile);
    json_out(['ok'=>true,'transcript'=>$transcript]);
  } else {
    json_out(['ok'=>false,'error'=>'No transcript found']);
  }
}

// Download error log
if($action==='download_error_log'){
  $meetingId = $_GET['meetingId'] ?? null;
  if(!$meetingId){
    http_response_code(400); echo "meetingId required"; exit;
  }
  
  $dir = meeting_dir($meetingId);
  $errorFile = "$dir/error.txt";
  
  if(file_exists($errorFile)){
    $errorLog = file_get_contents($errorFile);
    header('Content-Type: text/plain; charset=utf-8');
    header('Content-Disposition: attachment; filename="error_log_' . $meetingId . '.txt"');
    echo $errorLog;
    exit;
  } else {
    http_response_code(404); echo "No error log found"; exit;
  }
}

// Check if meeting parameter exists in URL
$meetingId = $_GET['meeting'] ?? $_SESSION['meetingId'] ?? bin2hex(random_bytes(4));
$_SESSION['meetingId'] = $meetingId;
?>
<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Mötesassistent (Wizard)</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎤</text></svg>">
  <link rel="stylesheet" href="assets/css/app.css">
  
  <!-- Markdown rendering libraries -->
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css">
  
  <!-- Mermaid for diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">Mötesassistent (Wizard)</div>
    <div class="header-actions">
      <div class="badge clickable" id="meetingIdBadge" title="Klicka för att växla möte">Möte: <span id="meetingId"><?= htmlspecialchars($meetingId, ENT_QUOTES, 'UTF-8') ?></span></div>
      <button class="btn theme-btn" id="themeBtn" title="Växla tema">
        <span class="theme-icon">🌙</span>
      </button>
      <button class="btn settings-btn" id="settingsBtn" title="Inställningar">
        <span class="settings-icon">⚙️</span>
      </button>
    </div>
  </div>
  <!-- Meeting selection interface -->
  <div id="meetingSelection" class="meeting-selection" style="display:none;">
    <div class="meeting-selection-content">
      <h1>Mötesassistent</h1>
      <p class="meeting-selection-description">Starta ett nytt möte för att komma igång.</p>
      
      <div class="meeting-actions">
        <button class="btn primary large" onclick="createNewMeeting()">
          <span class="btn-icon">➕</span>
          Starta nytt möte
        </button>
      </div>
    </div>
  </div>

  <div class="tabs" role="tablist" aria-label="Mötesassistent steg">
    <div class="tab active" id="tab-agenda" data-tab="agenda" role="tab" aria-selected="true" aria-controls="agenda" tabindex="0">
      <span class="tab-icon" aria-hidden="true">📋</span>
      <span class="tab-text">Agenda</span>
    </div>
    <div class="tab" id="tab-record" data-tab="record" role="tab" aria-selected="false" aria-controls="record" tabindex="0">
      <span class="tab-icon" aria-hidden="true">🎤</span>
      <span class="tab-text">Inspelning</span>
    </div>
    <div class="tab" id="tab-transcribe" data-tab="transcribe" role="tab" aria-selected="false" aria-controls="transcribe" tabindex="0">
      <span class="tab-icon" aria-hidden="true">📝</span>
      <span class="tab-text">Transkribera</span>
    </div>
    <div class="tab" id="tab-template" data-tab="template" role="tab" aria-selected="false" aria-controls="template" tabindex="0">
      <span class="tab-icon" aria-hidden="true">🤖</span>
      <span class="tab-text">AI-fyllning</span>
    </div>
    <div class="tab" id="tab-export" data-tab="export" role="tab" aria-selected="false" aria-controls="export" tabindex="0">
      <span class="tab-icon" aria-hidden="true">📤</span>
      <span class="tab-text">Export</span>
    </div>
  </div>

  <section class="panel step" id="agenda">
    <h2>1) Importera agenda (Markdown)</h2>
    <div class="template-selection">
      <label>Välj mall:</label>
      <select id="templateSelect" class="input">
        <option value="">-- Välj en mall --</option>
      </select>
    </div>
    
    <div class="file-import">
      <label class="btn">Välj .md <input id="agendaFile" type="file" accept=".md,.markdown,text/markdown,text/plain" hidden></label>
      <a class="btn" href="samples/agenda.md" download>Exempel</a>
    </div>
    
    <textarea id="agendaText" class="input" placeholder="Eller klistra in här..." style="display:none;"></textarea>
    
    <div class="agenda-preview">
      <h3>Förhandsgranskning</h3>
      <div id="agendaPreview" class="markdown-content" style="min-height:220px;"></div>
    </div>
  </section>

  <section class="panel step" id="record" style="display:none">
    <h2>2) Spela in mötet</h2>
    <div class="row">
      <div class="col">
        <div class="recording-controls">
          <h3>Direktinspelning</h3>
          <div class="row" style="gap:8px">
            <button class="btn primary" id="btnStartRec">🎤 Starta</button>
            <button class="btn" id="btnStopRec">⏹️ Stoppa</button>
          </div>
          <p id="recStatus" class="muted">Redo</p>
        </div>
        
        <div class="upload-controls">
          <h3>Eller ladda upp ljudfil</h3>
          <label class="btn" for="audioUpload">
            📁 Välj ljudfil (kan laddas upp flera)
            <input id="audioUpload" type="file" accept=".flac,.m4a,.mp3,.mp4,.mpeg,.mpga,.oga,.ogg,.wav,.webm,audio/*" hidden>
          </label>
          <p class="muted">Stödda format: FLAC, M4A, MP3, MP4, MPEG, MPGA, OGA, OGG, WAV, WebM</p>
          <p class="muted">💡 <strong>Tips:</strong> Du kan ladda upp flera ljudfiler och transkribera dem var för sig i steg 3.</p>
        </div>
        
        <div class="agenda-controls">
          <h3>Visa agenda under inspelning</h3>
          <button class="btn" id="btnShowAgenda">📋 Visa agenda</button>
        </div>
      </div>
      <div class="col">
        <h3>Uppladdade filer (<span id="audioFileCount">0</span>)</h3>
        <div id="audioFilesList" class="audio-files-list">
          <p id="uploadInfo" class="muted">Inga filer ännu</p>
        </div>
      </div>
    </div>
  </section>

  <section class="panel step" id="transcribe" style="display:none">
    <h2>3) Transkribera</h2>
    <div class="row">
      <div class="col">
        <label>Språk</label>
        <select id="transcriptLang" class="input">
          <option value="sv" selected>Svenska (sv)</option>
          <option value="en">Engelska (en)</option>
        </select>
      </div>
    </div>
    
    <div style="margin-top:12px">
      <h3>Ljudfiler att transkribera (<span id="transcribeFileCount">0</span>)</h3>
      <div id="transcribeFilesList" class="audio-files-list">
        <p class="muted">Inga ljudfiler uppladdade ännu</p>
      </div>
    </div>
    
    <div style="margin-top:12px">
      <h3>Samlat transkript</h3>
      <button class="btn" id="btnSaveTranscript">💾 Spara redigering</button>
      <button class="btn" id="btnClearTranscript">🗑️ Rensa allt</button>
    </div>
    <div style="margin-top:12px">
      <textarea id="transcript" class="input" placeholder="Transkript visas här... Du kan redigera texten direkt här."></textarea>
      <p class="muted" style="margin-top: 8px;">💡 <strong>Tips:</strong> Transkribera ljudfilerna ovan en i taget. Alla transkriptioner läggs till här. Du kan också redigera texten direkt.</p>
    </div>
  </section>

  <section class="panel step" id="template" style="display:none">
    <h2>4) AI-fyllning av mall</h2>
    
    <div class="template-layout">
      <div class="template-left">
        <div class="chat-interface">
          <h3>💬 Chat med LLM</h3>
          <div class="chat-messages" id="chatMessages">
            <div class="chat-message system">
              <strong>System:</strong> Välkommen! Jag kommer att fylla i mallen baserat på transkriptet och dina instruktioner. Varje meddelande du skickar kommer att uppdatera den ifyllda mallen.
            </div>
          </div>
          <div class="chat-input">
            <textarea id="chatInput" class="input" placeholder="Skriv instruktioner för hur mallen ska fyllas i (t.ex. 'Fokusera på risker' eller 'Lägg till fler detaljer om budget')..." rows="3"></textarea>
            <div class="chat-actions">
              <button class="btn" id="btnClearChat">🗑️ Rensa</button>
              <button class="btn primary" id="btnSendChat">Skicka</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="template-right">
        <h3>✅ Ifylld mall</h3>
        <div id="filledPreview" class="filled-preview markdown-content"></div>
        
        <div class="preview-actions">
          <button class="btn" id="btnPreviewFilled">👁️ Visa förhandsgranskning</button>
          <button class="btn" id="btnRegenerate">🔄 Generera om</button>
        </div>
      </div>
    </div>
    
    <!-- Collapsible sections for transcript and original template -->
    <div class="collapsible-section">
      <button class="collapsible-header" onclick="toggleCollapsible('templateDetails')">
        <span class="collapsible-icon">📋</span>
        <span class="collapsible-title">Original mall</span>
        <span class="collapsible-arrow">▼</span>
      </button>
      <div class="collapsible-content" id="templateDetails">
        <div class="transcript-section">
          <h3>📝 Transkribering</h3>
          <textarea id="templateTranscript" class="input" placeholder="Transkript visas här..." readonly></textarea>
        </div>
        
        <div class="template-section">
          <h3>📋 Mall att fylla i</h3>
          <div id="templatePreview" class="template-preview"></div>
        </div>
      </div>
    </div>
  </section>

  <section class="panel step" id="export" style="display:none">
    <h2>5) Export</h2>
    <div class="export-options">
      <div class="export-option">
        <h3>📄 Ifylld mall</h3>
        <p>Ladda ner den ifyllda mallen som Markdown-fil</p>
        <button class="btn primary" id="btnExportMd">📥 Ladda ner .md</button>
      </div>
      
      <div class="export-option">
        <h3>📦 Komplett export</h3>
        <p>Alla filer (transkript, mallar, chat) som ZIP-arkiv</p>
        <button class="btn" id="btnExportZip">📦 Ladda ner .zip</button>
      </div>
      
      <div class="export-option">
        <h3>📝 Word-dokument</h3>
        <p>Ifylld mall som Word-dokument (.docx)</p>
        <button class="btn" id="btnExportWord">📝 Ladda ner .docx</button>
      </div>
    </div>
  </section>
</div>

<!-- Agenda Popup Modal -->
<div id="agendaModal" class="modal">
  <div class="modal-content agenda-modal">
    <div class="modal-header">
      <h2>📋 Mötesagenda</h2>
      <button class="modal-close" id="closeAgenda">&times;</button>
    </div>
    <div class="modal-body">
      <div id="agendaContent" class="markdown-content"></div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="refreshAgenda">🔄 Uppdatera</button>
      <button class="btn primary" id="closeAgendaBtn">Stäng</button>
    </div>
  </div>
</div>

<!-- Settings Modal -->
<div id="settingsModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Inställningar</h2>
      <button class="modal-close" id="closeSettings">&times;</button>
    </div>
    <div class="modal-body">
      <div class="settings-section">
        <h3>🤖 LLM Inställningar</h3>
        <p class="muted">API-nycklar och andra inställningar konfigureras i .env-filen. Här kan du ändra modellvalet, temperatur och systemprompt.</p>
        
        <div class="form-group">
          <label>LLM Modell</label>
          <select id="llmModel" class="input">
            <option value="gpt-4o-mini">gpt-4o-mini (Snabbast, billigast)</option>
            <option value="gpt-4o">gpt-4o (Bästa kvalitet)</option>
            <option value="gpt-3.5-turbo">gpt-3.5-turbo (Snabb, bra kvalitet)</option>
          </select>
          <small class="muted">Modellen används för att fylla i mötesmallar baserat på transkript.</small>
        </div>
        
        <div class="form-group">
          <label>Temperatur (0-1)</label>
          <input type="number" id="llmTemperature" class="input" min="0" max="1" step="0.1" value="0.2">
          <small class="muted">Högre värde = mer kreativt, lägre värde = mer konsekvent.</small>
        </div>
        
        <div class="form-group">
          <label>Systemprompt</label>
          <textarea id="llmSystemPrompt" class="input" rows="4">Du är en expert på att fylla i mötesmallar baserat på transkript. Du ska vara noggrann, tydlig och följa exakt samma struktur som originalmallen. Använd svenska och var professionell i tonen.</textarea>
          <small class="muted">Instruktioner som LLM får innan den fyller i mallen.</small>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>ℹ️ Information</h3>
        <div class="info-box">
          <p><strong>API-nycklar:</strong> Konfigureras i <code>.env</code>-filen</p>
          <p><strong>Whisper-modell:</strong> Används för transkribering, konfigureras i <code>.env</code>-filen</p>
          <p><strong>LLM-modell, temperatur och systemprompt:</strong> Kan ändras här eller i <code>.env</code>-filen</p>
          <p><strong>Rate Limits:</strong> Vid 429-fel (rate limit) försöker systemet automatiskt igen med väntetid</p>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>🎵 Ljudformat</h3>
        <div class="info-box">
          <p><strong>Stödda format:</strong> FLAC, M4A, MP3, MP4, MPEG, MPGA, OGA, OGG, WAV, WebM</p>
          <p><strong>Vanliga konverteringar:</strong></p>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>AAC → MP3</li>
            <li>AIFF → WAV</li>
            <li>WMA → MP3</li>
            <li>MOV/AVI → MP4</li>
          </ul>
          <p><strong>Tips:</strong> Använd online-konverterare som CloudConvert eller FFmpeg för att konvertera filer.</p>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="resetSettings">Återställ</button>
      <button class="btn" id="closeSettingsFooter">Stäng</button>
      <button class="btn primary" id="saveSettings">Spara</button>
    </div>
  </div>
</div>

<!-- Meeting Manager Modal -->
<div id="meetingModal" class="modal">
  <div class="modal-content meeting-modal">
    <div class="modal-header">
      <h2>📁 Möteshanterare</h2>
      <button class="modal-close" id="closeMeetingModal">&times;</button>
    </div>
    <div class="modal-body">
      <div class="current-meeting-section" id="currentMeetingSection" style="display:none;">
        <h3>Aktivt möte</h3>
        <div class="current-meeting-info">
          <div class="current-meeting-id">
            <strong>Mötes-ID:</strong> <span id="currentMeetingIdDisplay"></span>
          </div>
          <div class="rename-meeting-section">
            <label for="renameMeetingInput"><strong>Byt namn på möte:</strong></label>
            <div class="rename-meeting-controls">
              <input type="text" id="renameMeetingInput" class="input" placeholder="Nytt namn för mötet (t.ex. projektmote-2025)">
              <button class="btn primary" id="renameMeetingBtn">📝 Byt namn</button>
            </div>
            <p class="muted" style="margin-top: 8px; font-size: 0.9em;">
              💡 <strong>Tips:</strong> Använd endast bokstäver, siffror, bindestreck och understreck. Detta byter namn på mappen och URL:en.
            </p>
          </div>
        </div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border);">
      </div>
      
      <div class="meeting-list">
        <div class="meeting-list-header">
          <h3>Dina möten</h3>
          <div class="meeting-actions">
            <button class="btn small primary" id="newMeetingFromModal">➕ Nytt möte</button>
            <button class="btn small" id="refreshMeetings">🔄 Uppdatera</button>
          </div>
        </div>
        <div id="meetingList" class="meeting-items">
          <div class="loading">Laddar möten...</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="closeMeetingBtn">Stäng</button>
    </div>
  </div>
</div>

<!-- Error Modal -->
<div id="errorModal" class="modal">
  <div class="modal-content error-modal">
    <div class="modal-header">
      <h2>⚠️ Fel uppstod</h2>
      <button class="modal-close" id="closeErrorModal">&times;</button>
    </div>
    <div class="modal-body">
      <div class="error-details">
        <h3>Felmeddelande:</h3>
        <div id="errorMessage" class="error-message"></div>
        
        <h3>Detaljer:</h3>
        <div id="errorDetails" class="error-details-content"></div>
        
        <h3>Vad kan du göra:</h3>
        <ul class="error-suggestions">
          <li>Kontrollera din internetanslutning</li>
          <li>Försök igen om några minuter</li>
          <li>Kontrollera att API-nycklarna är korrekt konfigurerade i .env-filen</li>
          <li>Kontakta support om problemet kvarstår</li>
        </ul>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" id="copyErrorBtn">📋 Kopiera fel</button>
      <button class="btn" id="viewErrorLogBtn">📄 Visa fel-logg</button>
      <button class="btn primary" id="closeErrorBtn">Stäng</button>
    </div>
  </div>
</div>

<div id="toast" class="toast">Meddelande</div>
<script src="assets/js/app.js"></script>
<script src="assets/js/recorder.js"></script>
</body>
</html>
