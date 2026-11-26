"use strict";
/*
 * Componentes do design system portados para a stack do §A.2.
 *
 * Portados (20 dos 24 do pacote), porque sao os que as telas do escopo usam:
 * ActivityTimeline, AlertBanner, ApprovalDeck, ApprovalItem, BridgeStatus,
 * Button, CommandBox, FactoryCard, FactoryHeader, Icon, KpiTile, MobileNav,
 * Pager, RiskTag, Segmented, Sidebar, StateBadge, StateIcon, Tabs, TaskRow.
 *
 * Segmented entrou na Onda 2, que trouxe a tela de nova fabrica e o filtro do
 * historico de aprovacoes.
 *
 * Fora do escopo, porque nenhuma tela construida usa: BarChart e ReportView
 * (Relatórios e Indicadores), ChangeRow (aba Alterações, que nao tem fonte no
 * contrato) e Toggle (Configurações).
 *
 * O CSS dos componentes vem do proprio pacote, copiado por
 * scripts/gerar-estilos.mjs para app/componentes.gerado.css. Ele usa somente
 * variaveis de tokens.json, que seguem sendo a fonte unica de cor, tamanho e raio.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rotuloCurto = exports.ESTADOS = exports.cx = exports.TaskRow = exports.Tabs = exports.StateIcon = exports.StateBadge = exports.Sidebar = exports.Segmented = exports.RiskTag = exports.Pager = exports.MobileNav = exports.KpiTile = exports.Icon = exports.FactoryHeader = exports.FactoryCard = exports.CommandBox = exports.Button = exports.BridgeStatus = exports.BridgeList = exports.ApprovalItem = exports.ApprovalDeck = exports.AlertBanner = exports.ActivityTimeline = void 0;
var ActivityTimeline_1 = require("./ActivityTimeline");
Object.defineProperty(exports, "ActivityTimeline", { enumerable: true, get: function () { return ActivityTimeline_1.ActivityTimeline; } });
var AlertBanner_1 = require("./AlertBanner");
Object.defineProperty(exports, "AlertBanner", { enumerable: true, get: function () { return AlertBanner_1.AlertBanner; } });
var ApprovalDeck_1 = require("./ApprovalDeck");
Object.defineProperty(exports, "ApprovalDeck", { enumerable: true, get: function () { return ApprovalDeck_1.ApprovalDeck; } });
var ApprovalItem_1 = require("./ApprovalItem");
Object.defineProperty(exports, "ApprovalItem", { enumerable: true, get: function () { return ApprovalItem_1.ApprovalItem; } });
var BridgeStatus_1 = require("./BridgeStatus");
Object.defineProperty(exports, "BridgeList", { enumerable: true, get: function () { return BridgeStatus_1.BridgeList; } });
Object.defineProperty(exports, "BridgeStatus", { enumerable: true, get: function () { return BridgeStatus_1.BridgeStatus; } });
var Button_1 = require("./Button");
Object.defineProperty(exports, "Button", { enumerable: true, get: function () { return Button_1.Button; } });
var CommandBox_1 = require("./CommandBox");
Object.defineProperty(exports, "CommandBox", { enumerable: true, get: function () { return CommandBox_1.CommandBox; } });
var FactoryCard_1 = require("./FactoryCard");
Object.defineProperty(exports, "FactoryCard", { enumerable: true, get: function () { return FactoryCard_1.FactoryCard; } });
var FactoryHeader_1 = require("./FactoryHeader");
Object.defineProperty(exports, "FactoryHeader", { enumerable: true, get: function () { return FactoryHeader_1.FactoryHeader; } });
var Icon_1 = require("./Icon");
Object.defineProperty(exports, "Icon", { enumerable: true, get: function () { return Icon_1.Icon; } });
var KpiTile_1 = require("./KpiTile");
Object.defineProperty(exports, "KpiTile", { enumerable: true, get: function () { return KpiTile_1.KpiTile; } });
var MobileNav_1 = require("./MobileNav");
Object.defineProperty(exports, "MobileNav", { enumerable: true, get: function () { return MobileNav_1.MobileNav; } });
var Pager_1 = require("./Pager");
Object.defineProperty(exports, "Pager", { enumerable: true, get: function () { return Pager_1.Pager; } });
var RiskTag_1 = require("./RiskTag");
Object.defineProperty(exports, "RiskTag", { enumerable: true, get: function () { return RiskTag_1.RiskTag; } });
var Segmented_1 = require("./Segmented");
Object.defineProperty(exports, "Segmented", { enumerable: true, get: function () { return Segmented_1.Segmented; } });
var Sidebar_1 = require("./Sidebar");
Object.defineProperty(exports, "Sidebar", { enumerable: true, get: function () { return Sidebar_1.Sidebar; } });
var StateBadge_1 = require("./StateBadge");
Object.defineProperty(exports, "StateBadge", { enumerable: true, get: function () { return StateBadge_1.StateBadge; } });
var StateIcon_1 = require("./StateIcon");
Object.defineProperty(exports, "StateIcon", { enumerable: true, get: function () { return StateIcon_1.StateIcon; } });
var Tabs_1 = require("./Tabs");
Object.defineProperty(exports, "Tabs", { enumerable: true, get: function () { return Tabs_1.Tabs; } });
var TaskRow_1 = require("./TaskRow");
Object.defineProperty(exports, "TaskRow", { enumerable: true, get: function () { return TaskRow_1.TaskRow; } });
var tipos_1 = require("./tipos");
Object.defineProperty(exports, "cx", { enumerable: true, get: function () { return tipos_1.cx; } });
Object.defineProperty(exports, "ESTADOS", { enumerable: true, get: function () { return tipos_1.ESTADOS; } });
Object.defineProperty(exports, "rotuloCurto", { enumerable: true, get: function () { return tipos_1.rotuloCurto; } });
