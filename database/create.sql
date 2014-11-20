DROP DATABASE `good-reviews`;
CREATE DATABASE `good-reviews`;

CREATE TABLE `good-reviews`.`goodreadsBook` (
  `goodreadsId` INT NOT NULL,
  `isbn` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `coverImageSrc` VARCHAR(500) NOT NULL,
  `subject` VARCHAR(5000) NULL,
  `body` VARCHAR(5000) NULL,
  `complete` BIT NOT NULL DEFAULT 0,
  `nextPage` INT NOT NULL DEFAULT 1,
  `totalReviews` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`goodreadsId`),
  CONSTRAINT UNIQUE (`isbn`));

CREATE TABLE `good-reviews`.`goodreadsReview` (
  `goodreadsId` INT NOT NULL,
  `bookGoodreadsId` INT NOT NULL,
  `authorGoodreadsId` INT NULL,
  `author` VARCHAR(500) NOT NULL,
  `body` VARCHAR(18000) NOT NULL,
  `status` VARCHAR(500) NOT NULL DEFAULT 'None',
  `url` VARCHAR(500) NULL,
  `authenticityToken` VARCHAR(500) NULL,
  `captchaUrl` VARCHAR(500) NULL,
  `captchaImageSrc` VARCHAR(1000) NULL,
  PRIMARY KEY(`goodreadsId`)
);