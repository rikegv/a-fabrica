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

export { ActivityTimeline } from './ActivityTimeline';
export type { ActivityTimelineItem, ActivityTimelineProps } from './ActivityTimeline';
export { AlertBanner } from './AlertBanner';
export type { AlertBannerProps } from './AlertBanner';
export { ApprovalDeck } from './ApprovalDeck';
export type { ApprovalDeckProps } from './ApprovalDeck';
export { ApprovalItem } from './ApprovalItem';
export type { ApprovalItemProps } from './ApprovalItem';
export { BridgeStatus } from './BridgeStatus';
export type { BridgeStatusProps } from './BridgeStatus';
export { Button } from './Button';
export type { ButtonProps } from './Button';
export { CommandBox } from './CommandBox';
export type { CommandBoxProps } from './CommandBox';
export { FactoryCard } from './FactoryCard';
export type { FactoryCardProps } from './FactoryCard';
export { FactoryHeader } from './FactoryHeader';
export type { FactoryHeaderProps } from './FactoryHeader';
export { Icon } from './Icon';
export type { IconName, IconProps } from './Icon';
export { KpiTile } from './KpiTile';
export type { KpiTileProps } from './KpiTile';
export { MobileNav } from './MobileNav';
export type { MobileNavProps } from './MobileNav';
export { Pager } from './Pager';
export type { PagerProps } from './Pager';
export { RiskTag } from './RiskTag';
export type { RiskTagProps } from './RiskTag';
export { Segmented } from './Segmented';
export type { SegmentedOption, SegmentedProps } from './Segmented';
export { Sidebar } from './Sidebar';
export type { SidebarProps } from './Sidebar';
export { StateBadge } from './StateBadge';
export type { StateBadgeProps } from './StateBadge';
export { StateIcon } from './StateIcon';
export type { StateIconProps } from './StateIcon';
export { Tabs } from './Tabs';
export type { TabsProps } from './Tabs';
export { TaskRow } from './TaskRow';
export type { TaskRowProps } from './TaskRow';
export { cx, ESTADOS, rotuloCurto } from './tipos';
export type { FactoryState, RiskLevel } from './tipos';
