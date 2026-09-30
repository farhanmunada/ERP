DROP INDEX `idx_layer_lookup` ON `item_cost_layers`;--> statement-breakpoint
ALTER TABLE `item_cost_layers` ADD `seq` bigint unsigned AUTO_INCREMENT NOT NULL, ADD CONSTRAINT `uq_layer_seq` UNIQUE(`seq`);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `seq` bigint unsigned AUTO_INCREMENT NOT NULL, ADD CONSTRAINT `uq_movement_seq` UNIQUE(`seq`);--> statement-breakpoint
CREATE INDEX `idx_layer_lookup` ON `item_cost_layers` (`item_id`,`warehouse_id`,`seq`);
