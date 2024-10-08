<?php
require 'db.php';
45.130.148.90
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $message = $_POST['message'];
    $results = $db->query("SELECT user_id FROM users");
    while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
        $userId = $row['user_id'];
        // Здесь вы можете использовать API Telegram для отправки сообщения
        // Например, через cURL или библиотеку для работы с Telegram API
    }
    echo "Broadcast sent successfully!";
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Send Broadcast</title>
</head>
<body>
    <h1>Send Broadcast</h1>
    <form method="post">
        <textarea name="message" rows="10" cols="50"></textarea><br>
        <button type="submit">Send Broadcast</button>
    </form>
</body>
</html>