-- CreateTable
CREATE TABLE `tasks` (
    `user_id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`user_id`, `task_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
