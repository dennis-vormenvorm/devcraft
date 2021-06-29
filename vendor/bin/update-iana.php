#!/usr/bin/env php
<?php

/**
 * Proxy PHP file generated by Composer
 *
 * This file includes the referenced bin path (../mundschenk-at/php-typography/src/bin/update-iana.php) using eval to remove the shebang if present
 *
 * @generated
 */

$binPath = realpath(__DIR__ . "/" . '../mundschenk-at/php-typography/src/bin/update-iana.php');
$contents = file_get_contents($binPath);
$contents = preg_replace('{^#!/.+\r?\n<\?(php)?}', '', $contents, 1, $replaced);
if ($replaced) {
    $contents = strtr($contents, array(
        '__FILE__' => var_export($binPath, true),
        '__DIR__' => var_export(dirname($binPath), true),
    ));

    eval($contents);
    exit(0);
}
include $binPath;
