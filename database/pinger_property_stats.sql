CREATE TABLE `pinger_property_stats` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `pinger_id` int(11) DEFAULT NULL,
  `data` blob,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
