<?php
header('Content-Type: application/json');

$templates = [];
$templateDir = __DIR__;

if (is_dir($templateDir)) {
    $files = scandir($templateDir);
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'md') {
            $templates[] = [
                'filename' => $file,
                'name' => ucwords(str_replace(['-', '_'], ' ', pathinfo($file, PATHINFO_FILENAME))),
                'path' => $file
            ];
        }
    }
}

echo json_encode($templates, JSON_UNESCAPED_UNICODE);
?>
