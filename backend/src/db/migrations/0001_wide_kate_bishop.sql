CREATE TABLE `item_cost_layers` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`quantity_remaining` decimal(18,4) NOT NULL,
	`unit_cost` decimal(18,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `item_cost_layers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `item_serials` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`serial_number` varchar(80) NOT NULL,
	`batch_no` varchar(50),
	`status` varchar(20) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `item_serials_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_serial_company_item_number` UNIQUE(`company_id`,`item_id`,`serial_number`)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(30) NOT NULL,
	`name` varchar(150) NOT NULL,
	`uom` varchar(20) NOT NULL,
	`costing_method` varchar(20) NOT NULL,
	`track_batch` boolean NOT NULL DEFAULT false,
	`track_serial` boolean NOT NULL DEFAULT false,
	`reorder_point` decimal(18,4) NOT NULL DEFAULT '0.0000',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_item_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`movement_type` varchar(20) NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`unit_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
	`total_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
	`balance_qty` decimal(18,4) NOT NULL,
	`balance_value` decimal(18,2) NOT NULL DEFAULT '0.00',
	`reference_type` varchar(30),
	`reference_id` varchar(64),
	`batch_no` varchar(50),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_opname_lines` (
	`id` char(36) NOT NULL,
	`opname_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`system_qty` decimal(18,4) NOT NULL,
	`physical_qty` decimal(18,4) NOT NULL,
	`difference_qty` decimal(18,4) NOT NULL,
	`unit_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
	`adjustment_value` decimal(18,2) NOT NULL DEFAULT '0.00',
	CONSTRAINT `stock_opname_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_opnames` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`opname_date` varchar(10) NOT NULL,
	`status` varchar(20) NOT NULL,
	`journal_entry_id` char(36),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_opnames_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_opname_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfers` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`item_id` char(36) NOT NULL,
	`from_warehouse_id` char(36) NOT NULL,
	`to_warehouse_id` char(36) NOT NULL,
	`quantity` decimal(18,4) NOT NULL,
	`status` varchar(20) NOT NULL,
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` varchar(30),
	CONSTRAINT `stock_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_transfer_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_stock` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`on_hand` decimal(18,4) NOT NULL DEFAULT '0.0000',
	`reserved` decimal(18,4) NOT NULL DEFAULT '0.0000',
	`avg_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouse_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_stock_item_warehouse` UNIQUE(`item_id`,`warehouse_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_layer_lookup` ON `item_cost_layers` (`item_id`,`warehouse_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_movement_company_item` ON `stock_movements` (`company_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `idx_movement_company_created` ON `stock_movements` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_opname_line_opname` ON `stock_opname_lines` (`opname_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_company_warehouse` ON `warehouse_stock` (`company_id`,`warehouse_id`);