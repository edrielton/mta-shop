-- ============================================================
-- Tabelas MySQL para o sync.lua do MTA Store
-- Cole no phpMyAdmin > SQL e clique em Executar
-- ============================================================

CREATE TABLE IF NOT EXISTS `jogadores` (
    `serial`        VARCHAR(64) NOT NULL PRIMARY KEY,
    `nome`          VARCHAR(64) DEFAULT '',
    `sobrenome`     VARCHAR(64) DEFAULT '',
    `idade`         INT DEFAULT 0,
    `sexo`          VARCHAR(1) DEFAULT 'M',
    `skin`          INT DEFAULT 0,
    `horas_jogadas` INT DEFAULT 0,
    `dinheiro`      INT DEFAULT 0,
    `banco`         INT DEFAULT 0,
    `faccao`        VARCHAR(64) DEFAULT 'Nenhuma',
    `cargo`         VARCHAR(64) DEFAULT 'Membro',
    `emprego`       VARCHAR(64) DEFAULT 'Desempregado',
    `nivel`         INT DEFAULT 1,
    `xp`            INT DEFAULT 0,
    `vida`          INT DEFAULT 100,
    `colete`        INT DEFAULT 0,
    `cnh`           TINYINT(1) DEFAULT 0,
    `rg`            TINYINT(1) DEFAULT 0,
    `porte_arma`    TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `veiculos` (
    `id`        INT AUTO_INCREMENT PRIMARY KEY,
    `serial`    VARCHAR(64) NOT NULL,
    `modelo`    INT DEFAULT 0,
    `placa`     VARCHAR(32) DEFAULT '',
    `cor`       INT DEFAULT 0,
    `garagem`   VARCHAR(64) DEFAULT '',
    INDEX `idx_veiculos_serial` (`serial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inventario` (
    `id`         INT AUTO_INCREMENT PRIMARY KEY,
    `serial`     VARCHAR(64) NOT NULL,
    `item`       VARCHAR(128) NOT NULL,
    `quantidade` INT DEFAULT 1,
    INDEX `idx_inventario_serial` (`serial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
