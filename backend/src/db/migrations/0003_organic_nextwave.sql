CREATE TABLE `goods_receipt_lines` (
	`id` char(36) NOT NULL,
	`grn_id` char(36) NOT NULL,
	`po_line_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`qty_received` decimal(18,4) NOT NULL,
	`unit_cost` decimal(18,2) NOT NULL,
	`batch_no` varchar(50),
	CONSTRAINT `goods_receipt_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goods_receipts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`grn_date` varchar(10) NOT NULL,
	`po_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`status` varchar(20) NOT NULL,
	`journal_entry_id` char(36),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `goods_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_grn_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `procurement_settings` (
	`company_id` char(36) NOT NULL,
	`qty_tolerance_pct` decimal(18,2) NOT NULL DEFAULT '2.00',
	`price_tolerance_pct` decimal(18,2) NOT NULL DEFAULT '2.00',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `procurement_settings_company_id` PRIMARY KEY(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_lines` (
	`id` char(36) NOT NULL,
	`po_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`qty` decimal(18,4) NOT NULL,
	`unit_price` decimal(18,2) NOT NULL,
	`received_qty` decimal(18,4) NOT NULL DEFAULT '0.0000',
	`billed_qty` decimal(18,4) NOT NULL DEFAULT '0.0000',
	CONSTRAINT `purchase_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`po_date` varchar(10) NOT NULL,
	`vendor_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`status` varchar(20) NOT NULL,
	`pr_id` char(36),
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(18,2) NOT NULL DEFAULT '0.00',
	`total` decimal(18,2) NOT NULL DEFAULT '0.00',
	`approval_request_id` char(36),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_po_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `purchase_requisition_lines` (
	`id` char(36) NOT NULL,
	`pr_id` char(36) NOT NULL,
	`item_id` char(36) NOT NULL,
	`qty` decimal(18,4) NOT NULL,
	`notes` varchar(255),
	CONSTRAINT `purchase_requisition_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_requisitions` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`pr_date` varchar(10) NOT NULL,
	`status` varchar(20) NOT NULL,
	`notes` varchar(255),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchase_requisitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_pr_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `vendor_bill_lines` (
	`id` char(36) NOT NULL,
	`bill_id` char(36) NOT NULL,
	`po_line_id` char(36),
	`item_id` char(36) NOT NULL,
	`qty` decimal(18,4) NOT NULL,
	`unit_price` decimal(18,2) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	CONSTRAINT `vendor_bill_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendor_bills` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`bill_date` varchar(10) NOT NULL,
	`vendor_id` char(36) NOT NULL,
	`po_id` char(36),
	`status` varchar(20) NOT NULL,
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0.00',
	`tax` decimal(18,2) NOT NULL DEFAULT '0.00',
	`total` decimal(18,2) NOT NULL DEFAULT '0.00',
	`match_result` json,
	`override_reason` varchar(255),
	`overridden_by` char(36),
	`journal_entry_id` char(36),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendor_bills_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_bill_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(30) NOT NULL,
	`name` varchar(150) NOT NULL,
	`email` varchar(150),
	`phone` varchar(30),
	`address` varchar(255),
	`npwp` varchar(30),
	`payment_term_days` int NOT NULL DEFAULT 30,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_vendor_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE INDEX `idx_grn_line_grn` ON `goods_receipt_lines` (`grn_id`);--> statement-breakpoint
CREATE INDEX `idx_grn_company_po` ON `goods_receipts` (`company_id`,`po_id`);--> statement-breakpoint
CREATE INDEX `idx_po_line_po` ON `purchase_order_lines` (`po_id`);--> statement-breakpoint
CREATE INDEX `idx_po_company_vendor` ON `purchase_orders` (`company_id`,`vendor_id`);--> statement-breakpoint
CREATE INDEX `idx_pr_line_pr` ON `purchase_requisition_lines` (`pr_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_line_bill` ON `vendor_bill_lines` (`bill_id`);--> statement-breakpoint
CREATE INDEX `idx_bill_company_vendor` ON `vendor_bills` (`company_id`,`vendor_id`);