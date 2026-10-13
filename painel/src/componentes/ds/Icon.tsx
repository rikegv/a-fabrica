/* Icon, portado de bundle.js. SVG do proprio sistema, traco 1.6px, grade de 20px. */

export type IconName =
  | 'overview'
  | 'factories'
  | 'approvals'
  | 'reports'
  | 'metrics'
  | 'settings'
  | 'plus'
  | 'more'
  | 'chevronLeft'
  | 'chevronRight'
  | 'search'
  | 'folder'
  | 'pause'
  | 'back'
  | 'copy';

const TRACOS: Record<IconName, string> = {
  overview: 'M3.5 3.5h5.5v5.5H3.5zM11 3.5h5.5v5.5H11zM3.5 11h5.5v5.5H3.5zM11 11h5.5v5.5H11z',
  factories: 'M10 2.8 17 6.5 10 10.2 3 6.5ZM3 10l7 3.7 7-3.7M3 13.5l7 3.7 7-3.7',
  approvals: 'M10 2.5 17.5 10 10 17.5 2.5 10Z',
  reports: 'M5 2.5h7l3.5 3.5v11.5H5zM8 9h5M8 12h5M8 15h3',
  metrics: 'M3.5 16.5h13M5.5 13.5v-3M9 13.5V6.5M12.5 13.5v-5M16 13.5V4',
  settings: 'M4 5.5h7M14 5.5h2M4 10h2M9 10h7M4 14.5h9M16 14.5h0M12.5 4v3M7.5 8.5v3M14.5 13v3',
  plus: 'M10 4v12M4 10h12',
  more: 'M5 10h.01M10 10h.01M15 10h.01',
  chevronLeft: 'M12 5l-5 5 5 5',
  chevronRight: 'M8 5l5 5-5 5',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM13.5 13.5 17 17',
  folder: 'M2.5 5.5a1 1 0 0 1 1-1h4l2 2h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1Z',
  pause: 'M7 4.5v11M13 4.5v11',
  back: 'M15 10H5M9 5l-5 5 5 5',
  copy: 'M7 7h9v9H7zM4 13V4h9'
};

export interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="gf-icon"
    >
      <path d={TRACOS[name] ?? TRACOS.more} />
    </svg>
  );
}
