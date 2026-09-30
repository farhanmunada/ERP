CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`company_id` char(36) NOT NULL,
	`user_id` char(36),
	`action` varchar(50) NOT NULL,
	`entity_type` varchar(50) NOT NULL,
	`entity_id` varchar(64) NOT NULL,
	`state_before` json,
	`state_after` json,
	`ip_address` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_sequences` (
	`company_id` char(36) NOT NULL,
	`doc_type` varchar(30) NOT NULL,
	`prefix` varchar(20) NOT NULL,
	`next_number` bigint unsigned NOT NULL DEFAULT 1,
	CONSTRAINT `uq_doc_seq` UNIQUE(`company_id`,`doc_type`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key_value` varchar(255) NOT NULL,
	`user_id` char(36) NOT NULL,
	`endpoint` varchar(200) NOT NULL,
	`request_hash` varchar(64) NOT NULL,
	`response_status` bigint unsigned NOT NULL,
	`response_body` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idempotency_keys_key_value` PRIMARY KEY(`key_value`)
);
--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event_id` char(36) NOT NULL,
	`event_type` varchar(100) NOT NULL,
	`aggregate_type` varchar(50) NOT NULL,
	`aggregate_id` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`published_at` varchar(30),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outbox_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_outbox_event_id` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `processed_events` (
	`event_id` char(36) NOT NULL,
	`processed_at` varchar(30) NOT NULL,
	CONSTRAINT `processed_events_event_id` PRIMARY KEY(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `approval_requests` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`document_type` varchar(30) NOT NULL,
	`document_id` char(36) NOT NULL,
	`rule_id` char(36) NOT NULL,
	`current_level` int NOT NULL DEFAULT 1,
	`total_levels` int NOT NULL,
	`status` varchar(20) NOT NULL,
	`history` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_rules` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`document_type` varchar(30) NOT NULL,
	`min_amount` varchar(30) NOT NULL,
	`max_amount` varchar(30),
	`levels` json NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approval_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(150) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_branch_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` char(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(150) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_company_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` char(36) NOT NULL,
	`code` varchar(80) NOT NULL,
	`description` varchar(200) NOT NULL,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_permission_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` varchar(30) NOT NULL,
	`revoked_at` varchar(30),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_refresh_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` char(36) NOT NULL,
	`permission_id` char(36) NOT NULL,
	CONSTRAINT `role_permissions_role_id_permission_id_pk` PRIMARY KEY(`role_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_role_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` char(36) NOT NULL,
	`role_id` char(36) NOT NULL,
	CONSTRAINT `user_roles_user_id_role_id_pk` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `user_scopes` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`scope_type` varchar(20) NOT NULL,
	`scope_id` char(36) NOT NULL,
	CONSTRAINT `user_scopes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`email` varchar(150) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`full_name` varchar(150) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_user_company_email` UNIQUE(`company_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`branch_id` char(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(150) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_warehouse_branch_code` UNIQUE(`branch_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(150) NOT NULL,
	`parent_id` char(36),
	`type` varchar(20) NOT NULL,
	`normal_balance` varchar(6) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_account_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`doc_number` varchar(50) NOT NULL,
	`entry_date` varchar(10) NOT NULL,
	`description` varchar(255) NOT NULL,
	`source_type` varchar(30) NOT NULL,
	`source_id` varchar(64),
	`status` varchar(20) NOT NULL,
	`reversal_of_id` char(36),
	`posted_at` varchar(30),
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_journal_company_doc` UNIQUE(`company_id`,`doc_number`)
);
--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` char(36) NOT NULL,
	`entry_id` char(36) NOT NULL,
	`account_id` char(36) NOT NULL,
	`line_number` int NOT NULL,
	`debit` decimal(18,2) NOT NULL DEFAULT '0.00',
	`credit` decimal(18,2) NOT NULL DEFAULT '0.00',
	`description` varchar(255),
	CONSTRAINT `journal_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_company_created` ON `audit_logs` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_idempotency_created` ON `idempotency_keys` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_outbox_unpublished` ON `outbox_events` (`published_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_approval_doc` ON `approval_requests` (`document_type`,`document_id`);--> statement-breakpoint
CREATE INDEX `idx_approval_rule_lookup` ON `approval_rules` (`company_id`,`document_type`);--> statement-breakpoint
CREATE INDEX `idx_branch_company` ON `branches` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_refresh_user` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_scope_user` ON `user_scopes` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_company` ON `warehouses` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_account_parent` ON `accounts` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_company_date` ON `journal_entries` (`company_id`,`entry_date`);--> statement-breakpoint
CREATE INDEX `idx_journal_source` ON `journal_entries` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_line_entry` ON `journal_lines` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_line_account` ON `journal_lines` (`account_id`);