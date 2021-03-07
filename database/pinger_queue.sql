CREATE TABLE `pinger_queue` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `pinger_id` int(11) DEFAULT NULL,
  `data` blob,
  `locked` tinyint(4) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pinger_id` (`pinger_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
