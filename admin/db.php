<?php
require 'config.php';

try {
    $db = new SQLite3(DB_PATH);
} catch (Exception $e) {
    die("Could not connect to the database: " . $e->getMessage());
}
?>