import * as React from 'react';
export type IconName =
  | "IconAlarmMonoNotiNotification"
  | "IconArrowDownMonoArrow"
  | "IconArrowLeftMonoArrow"
  | "IconArrowRightMonoArrow"
  | "IconArrowUpMonoUp"
  | "IconBankMonoBankAccount"
  | "IconBellStrokeMono"
  | "IconBinMonoBinTrash"
  | "IconCameraMonoCameraPicture"
  | "IconCardMonoCard"
  | "IconChartMono"
  | "IconCheckMonoCheckConfirm"
  | "IconClockMonoClockWatch"
  | "IconCoinMonoCoinWon"
  | "IconCopyMonoCopyPaste"
  | "IconDollarMonoDollar"
  | "IconDotsMonoDotDots"
  | "IconDownloadMonoDownloadSave"
  | "IconFilterMonoFilterControl"
  | "IconGiftMonoBoxGift"
  | "IconHeartMonoHeartLove"
  | "IconHomeMonoHomeFamily"
  | "IconInfoCircleMonoInfo"
  | "IconLockMonoLockSecret"
  | "IconMailMonoLetter"
  | "IconMinusMonoMinusDelete"
  | "IconMoneyMonoMoneyBill"
  | "IconPencilMonoPencilPen"
  | "IconPhoneMonoPhoneHandphone"
  | "IconPlusMonoPlusAdd"
  | "IconQrMonoQr"
  | "IconQuestionMonoQuestionQuestionmark"
  | "IconRefreshMonoRefreshRe"
  | "IconScanMonoScanCode"
  | "IconSearchMonoSearchFind"
  | "IconSettingMonoSettingWheel"
  | "IconShareMonoShareExternal"
  | "IconStarMonoStarPopular"
  | "IconSyncMonoSyncLink"
  | "IconUserMonoUserPersona"
  | "IconWonMonoWon"
  | "IconXMonoXDelete";
export type IconAlias =
  | "search" | "x" | "close" | "check" | "setting" | "gear" | "home"
  | "bell" | "bell-stroke" | "alarm" | "heart" | "star" | "plus" | "minus"
  | "share" | "user" | "lock" | "filter" | "gift" | "bank" | "camera"
  | "card" | "chart" | "clock" | "coin" | "copy" | "dollar" | "download"
  | "money" | "question" | "won" | "arrow-right" | "arrow-left"
  | "arrow-down" | "arrow-up" | "chevron-right" | "chevron-left" | "bin"
  | "trash" | "dots" | "more" | "info" | "mail" | "pencil" | "edit"
  | "phone" | "qr" | "refresh" | "scan" | "sync";
export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'color'> {
  /** Friendly alias (e.g. "search") or raw Figma component name. */
  name: IconName | IconAlias;
  /** px or any CSS length. Default 24. */
  size?: number | string;
  /** CSS color applied to currentColor fills. */
  color?: string;
}
export declare const Icon: React.FC<IconProps>;
export declare const ICON_ALIASES: Record<string, IconName>;
export default Icon;
