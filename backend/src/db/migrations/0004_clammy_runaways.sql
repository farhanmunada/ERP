CREATE TABLE `credit_note_lines` (
	`id` char(36) NOT NULL,
	`cn_id` char(36) NOT NULL,
	`invoice_line_id` char(36),
	`item_id` char(36) NOT NULL,
	`qty` decimal(18,4) NOT NULL,
	`unit_price` decimal(18,2) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`unit_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
	`cogs_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
	CONSTRAINT `credit_note_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`cn_date` varchar(10) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`invoice_id` char(36) NOT NULL,
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(18,2) NOT NULL DEFAULT '0.00',
	`total` decimal(18,2) NOT NULL DEFAULT '0.00',
	`cogs` decimal(18,2) NOT NULL DEFAULT '0.00',
	`journal_entry_id` char(36),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_credit_note_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `customer_invoice_lines` (
	`id` char(36) NOT NULL,
	`invoice_id` char(36) NOT NULL,
	`so_line_id` char(36),
	`item_id` char(36) NOT NULL,
	`qty` decimal(18,4) NOT NULL,
	`unit_price` decimal(18,2) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`unit_cost` decimal(18,2) NOT NULL DEFAULT '0.00',
	`cogs_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
	CONSTRAINT `customer_invoice_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_invoices` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`invoice_date` varchar(10) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`do_id` char(36),
	`status` varchar(20) NOT NULL,
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(18,2) NOT NULL DEFAULT '0.00',
	`total` decimal(18,2) NOT NULL DEFAULT '0.00',
	`cogs` decimal(18,2) NOT NULL DEFAULT '0.00',
	`journal_entry_id` char(36),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_invoice_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(30) NOT NULL,
	`name` varchar(150) NOT NULL,
	`email` varchar(150),
	`phone` varchar(30),
	`address` varchar(255),
	`npwp` varchar(30),
	`credit_limit` decimal(18,2) NOT NULL DEFAULT '0.00',
	`payment_term_days` int NOT NULL DEFAULT 30,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_customer_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `delivery_order_lines` (
	`id` char(36) NOT NULL,
	`do_id` char(36) NOT NULL,
	`so_line_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`qty_delivered` decimal(18,4) NOT NULL,
	`unit_cost` decimal(18,2) NOT NULL,
	`batch_no` varchar(50),
	CONSTRAINT `delivery_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_orders` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`do_date` varchar(10) NOT NULL,
	`so_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`status` varchar(20) NOT NULL,
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_do_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `quotation_lines` (
	`id` char(36) NOT NULL,
	`quotation_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`qty` decimal(18,4) NOT NULL,
	`unit_price` decimal(18,2) NOT NULL,
	`discount` decimal(18,2) NOT NULL DEFAULT '0.00',
	`subtotal` decimal(18,2) NOT NULL,
	CONSTRAINT `quotation_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`quote_date` varchar(10) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`status` varchar(20) NOT NULL,
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(18,2) NOT NULL DEFAULT '0.00',
	`total` decimal(18,2) NOT NULL DEFAULT '0.00',
	`valid_until` varchar(10),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_quotation_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `sales_order_lines` (
	`id` char(36) NOT NULL,
	`so_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`qty` decimal(18,4) NOT NULL,
	`unit_price` decimal(18,2) NOT NULL,
	`discount` decimal(18,2) NOT NULL DEFAULT '0.00',
	`subtotal` decimal(18,2) NOT NULL,
	`delivered_qty` decimal(18,4) NOT NULL DEFAULT '0.0000',
	`invoiced_qty` decimal(18,4) NOT NULL DEFAULT '0.0000',
	CONSTRAINT `sales_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`so_date` varchar(10) NOT NULL,
	`customer_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`status` varchar(20) NOT NULL,
	`quotation_id` char(36),
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(18,2) NOT NULL DEFAULT '0.00',
	`total` decimal(18,2) NOT NULL DEFAULT '0.00',
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_so_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE INDEX `idx_credit_note_line_cn` ON `credit_note_lines` (`cn_id`);--> statement-breakpoint
CREATE INDEX `idx_credit_note_company_invoice` ON `credit_notes` (`company_id`,`invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_invoice_line_invoice` ON `customer_invoice_lines` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_invoice_company_customer` ON `customer_invoices` (`company_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_do_line_do` ON `delivery_order_lines` (`do_id`);--> statement-breakpoint
CREATE INDEX `idx_do_company_so` ON `delivery_orders` (`company_id`,`so_id`);--> statement-breakpoint
CREATE INDEX `idx_quotation_line_quotation` ON `quotation_lines` (`quotation_id`);--> statement-breakpoint
CREATE INDEX `idx_so_line_so` ON `sales_order_lines` (`so_id`);--> statement-breakpoint
CREATE INDEX `idx_so_company_customer` ON `sales_orders` (`company_id`,`customer_id`);