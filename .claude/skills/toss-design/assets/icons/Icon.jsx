import icons from './icon-data.js';

// Friendly aliases → raw Figma component names. Use either with <Icon name="…" />.
export const ICON_ALIASES = {
  'search': 'IconSearchMonoSearchFind',
  'x': 'IconXMonoXDelete',
  'close': 'IconXMonoXDelete',
  'check': 'IconCheckMonoCheckConfirm',
  'setting': 'IconSettingMonoSettingWheel',
  'gear': 'IconSettingMonoSettingWheel',
  'home': 'IconHomeMonoHomeFamily',
  'bell': 'IconAlarmMonoNotiNotification',
  'bell-stroke': 'IconBellStrokeMono',
  'alarm': 'IconAlarmMonoNotiNotification',
  'heart': 'IconHeartMonoHeartLove',
  'star': 'IconStarMonoStarPopular',
  'plus': 'IconPlusMonoPlusAdd',
  'minus': 'IconMinusMonoMinusDelete',
  'share': 'IconShareMonoShareExternal',
  'user': 'IconUserMonoUserPersona',
  'lock': 'IconLockMonoLockSecret',
  'filter': 'IconFilterMonoFilterControl',
  'gift': 'IconGiftMonoBoxGift',
  'bank': 'IconBankMonoBankAccount',
  'camera': 'IconCameraMonoCameraPicture',
  'card': 'IconCardMonoCard',
  'chart': 'IconChartMono',
  'clock': 'IconClockMonoClockWatch',
  'coin': 'IconCoinMonoCoinWon',
  'copy': 'IconCopyMonoCopyPaste',
  'dollar': 'IconDollarMonoDollar',
  'download': 'IconDownloadMonoDownloadSave',
  'money': 'IconMoneyMonoMoneyBill',
  'question': 'IconQuestionMonoQuestionQuestionmark',
  'won': 'IconWonMonoWon',
  'arrow-right': 'IconArrowRightMonoArrow',
  'arrow-left': 'IconArrowLeftMonoArrow',
  'arrow-down': 'IconArrowDownMonoArrow',
  'arrow-up': 'IconArrowUpMonoUp',
  'chevron-right': 'IconArrowRightMonoArrow',
  'chevron-left': 'IconArrowLeftMonoArrow',
  'bin': 'IconBinMonoBinTrash',
  'trash': 'IconBinMonoBinTrash',
  'dots': 'IconDotsMonoDotDots',
  'more': 'IconDotsMonoDotDots',
  'info': 'IconInfoCircleMonoInfo',
  'mail': 'IconMailMonoLetter',
  'pencil': 'IconPencilMonoPencilPen',
  'edit': 'IconPencilMonoPencilPen',
  'phone': 'IconPhoneMonoPhoneHandphone',
  'qr': 'IconQrMonoQr',
  'refresh': 'IconRefreshMonoRefreshRe',
  'scan': 'IconScanMonoScanCode',
  'sync': 'IconSyncMonoSyncLink',
};

export function Icon({ name, size = 24, color, style, ...rest }) {
  const key = icons[name] ? name : ICON_ALIASES[name];
  const d = icons[key];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={d.viewBox}
      fill="none"
      style={{ color: color, display: 'inline-block', flexShrink: 0, ...style }}
      // body strings are emitter-controlled <path> markup — geometry,
      // numeric fills and transforms only; no .fig-authored text reaches them.
      dangerouslySetInnerHTML={{ __html: d.body }}
      {...rest}
    />
  );
}
export default Icon;
