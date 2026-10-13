import type * as React from 'react';

export type FactoryState = 'running' | 'approval' | 'idle' | 'done' | 'failed' | 'offline';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface AlertBannerProps { tone?: 'approval' | 'offline' | 'failed'; title: React.ReactNode; detail?: React.ReactNode; actionLabel?: string; onAction?: () => void }
export declare function AlertBanner(props: AlertBannerProps): React.ReactElement;

export interface StateBadgeProps { state: FactoryState; label?: string; size?: 'md' | 'lg' }
export declare function StateBadge(props: StateBadgeProps): React.ReactElement;

export interface StateIconProps { state: FactoryState; size?: number }
export declare function StateIcon(props: StateIconProps): React.ReactElement;

export interface BridgeStatusProps { online: boolean; detail?: string; machine?: string }
export declare function BridgeStatus(props: BridgeStatusProps): React.ReactElement;

export interface FactoryCardProps { project: string; agent: string; state: FactoryState; doing: string; elapsed: string; usage: string; pending?: string; onOpen?: () => void }
export declare function FactoryCard(props: FactoryCardProps): React.ReactElement;

export interface FactoryHeaderProps { project: string; agent: string; state: FactoryState; elapsed: string; usage: string; onPause?: () => void; onRestart?: () => void; onStop?: () => void }
export declare function FactoryHeader(props: FactoryHeaderProps): React.ReactElement;

export interface ApprovalItemProps {
  title: string; why?: React.ReactNode; impact?: React.ReactNode; touches?: string[]; risk?: RiskLevel;
  project?: string; task?: string; waiting?: string; stale?: boolean; touch?: boolean; flat?: boolean;
  onApprove?: () => void; onReject?: (reason: string) => void; onApproveWithNote?: (note: string) => void;
  decision?: 'approved' | 'rejected' | 'noted'; decidedAt?: string; note?: string;
}
export declare function ApprovalItem(props: ApprovalItemProps): React.ReactElement;

export interface RiskTagProps { level: RiskLevel }
export declare function RiskTag(props: RiskTagProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'touch'; block?: boolean; icon?: React.ReactNode }
export declare function Button(props: ButtonProps): React.ReactElement;

export interface TabsProps { tabs: { id: string; label: string; count?: number }[]; value: string; onChange?: (id: string) => void }
export declare function Tabs(props: TabsProps): React.ReactElement;

export interface ActivityTimelineProps { live?: boolean; items: { time: string; text: string; detail?: string; kind?: 'step' | 'approval' | 'error' | 'done' }[] }
export declare function ActivityTimeline(props: ActivityTimelineProps): React.ReactElement;

export interface CommandBoxProps { onSend?: (text: string) => void; onSaved?: () => void; placeholder?: string; defaultValue?: string; disabledReason?: string }
export declare function CommandBox(props: CommandBoxProps): React.ReactElement;

export interface TaskRowProps { state: FactoryState; title: string; agent?: string; elapsed?: string; stateLabel?: string }
export declare function TaskRow(props: TaskRowProps): React.ReactElement;

export interface ChangeRowProps { kind: 'added' | 'modified' | 'removed'; path: string; add?: number; del?: number }
export declare function ChangeRow(props: ChangeRowProps): React.ReactElement;

export interface ReportViewProps { title: string; meta?: string; children?: React.ReactNode }
export declare function ReportView(props: ReportViewProps): React.ReactElement;

export interface MobileNavProps { items: { id: string; label: string; count?: number; icon?: 'approvals' | 'factories' | 'reports' | 'more' }[]; value: string; onChange?: (id: string) => void }
export declare function MobileNav(props: MobileNavProps): React.ReactElement;

export interface SidebarProps { items: { id: string; label: string; icon?: IconName; count?: number; alert?: boolean }[]; value: string; onChange?: (id: string) => void; projects?: { name: string; state: FactoryState; count?: number }[]; bridge?: BridgeStatusProps; brand?: string; owner?: string; collapsed?: boolean }
export declare function Sidebar(props: SidebarProps): React.ReactElement;

export interface KpiTileProps { label: string; value: string; unit?: string; series?: number[]; progress?: number; delta?: { dir?: 'up' | 'down'; text: string; tone?: 'good' | 'bad' }; hint?: string }
export declare function KpiTile(props: KpiTileProps): React.ReactElement;

export interface ApprovalDeckProps { items: ApprovalItemProps[]; touch?: boolean; onApprove?: (item: ApprovalItemProps) => void; onReject?: (item: ApprovalItemProps, reason: string) => void; onApproveWithNote?: (item: ApprovalItemProps, note: string) => void }
export declare function ApprovalDeck(props: ApprovalDeckProps): React.ReactElement;

export type IconName = 'overview' | 'factories' | 'approvals' | 'reports' | 'metrics' | 'settings' | 'plus' | 'more' | 'chevronLeft' | 'chevronRight' | 'search' | 'folder' | 'pause' | 'back' | 'copy';
export interface IconProps { name: IconName; size?: number }
export declare function Icon(props: IconProps): React.ReactElement;

export interface SegmentedProps { options: (string | { id: string; label: string; hint?: string; disabled?: boolean })[]; value: string; onChange?: (id: string) => void; block?: boolean }
export declare function Segmented(props: SegmentedProps): React.ReactElement;

export interface ToggleProps { label: string; hint?: string; checked: boolean; onChange?: (on: boolean) => void; disabled?: boolean }
export declare function Toggle(props: ToggleProps): React.ReactElement;

export interface PagerProps { page: number; total: number; onChange?: (page: number) => void; label?: string }
export declare function Pager(props: PagerProps): React.ReactElement;

export interface BarChartProps { data: { label: string; value: number; display?: string; short?: string }[]; horizontal?: boolean; height?: number | string; ticks?: number[]; format?: (v: number) => string; labelEvery?: number; highlightLast?: boolean }
export declare function BarChart(props: BarChartProps): React.ReactElement;

declare global { interface Window { Fabricas: {
  AlertBanner: typeof AlertBanner; StateBadge: typeof StateBadge; StateIcon: typeof StateIcon; BridgeStatus: typeof BridgeStatus;
  FactoryCard: typeof FactoryCard; FactoryHeader: typeof FactoryHeader; ApprovalItem: typeof ApprovalItem; RiskTag: typeof RiskTag;
  Button: typeof Button; Tabs: typeof Tabs; ActivityTimeline: typeof ActivityTimeline; CommandBox: typeof CommandBox;
  TaskRow: typeof TaskRow; ChangeRow: typeof ChangeRow; ReportView: typeof ReportView; MobileNav: typeof MobileNav;
  Sidebar: typeof Sidebar; KpiTile: typeof KpiTile; ApprovalDeck: typeof ApprovalDeck; Icon: typeof Icon;
  Segmented: typeof Segmented; Toggle: typeof Toggle; Pager: typeof Pager; BarChart: typeof BarChart;
} } }
