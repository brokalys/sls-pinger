CREATE TABLE `pinger_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `to` varchar(255) DEFAULT NULL,
  `cc` varchar(255) DEFAULT NULL,
  `bcc` varchar(255) DEFAULT NULL,
  `from` varchar(255) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `content` longblob,
  `property_id` int(11) DEFAULT NULL,
  `pinger_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `email_type` varchar(30) DEFAULT 'pinger',
  `sent_at` timestamp NULL DEFAULT NULL,
  `response` blob,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
