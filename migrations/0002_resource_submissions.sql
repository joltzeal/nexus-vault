CREATE TABLE `resource_submissions` (
  `id` text PRIMARY KEY NOT NULL,
  `vault_id` text NOT NULL,
  `space_id` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `submitter_id` text,
  `submitter_name` text DEFAULT '' NOT NULL,
  `submitter_email` text DEFAULT '' NOT NULL,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `url` text NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `reviewed_by` text,
  `review_note` text DEFAULT '' NOT NULL,
  `reviewed_at` text,
  `approved_resource_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `deleted_at` text,
  FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`submitter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`approved_resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `resource_submissions_vault_status_created_idx` ON `resource_submissions` (`vault_id`, `status`, `created_at`);
