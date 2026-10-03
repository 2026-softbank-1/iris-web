import { Layers, Zap } from 'lucide-react';
import type { AnalysisGateDto } from '../lib/endpoints';
import { useI18n } from '../i18n';

/** 서비스가 레포 구성 확인(분석 게이트)을 거쳐 만들어졌는지. skip 이면 "AI 분석 생략", analyze 면 "분석으로 생성됨 · unit". */
export function AnalysisGateBadge({ gate }: { gate?: AnalysisGateDto | null }) {
  const { t } = useI18n();
  if (!gate) return null;
  const skipped = gate.decision === 'skip';
  const label = skipped ? t('service.gate.skipped') : gate.unitId ? t('service.gate.analyzed', { unit: gate.unitId }) : t('service.gate.analyzedNoUnit');
  return (
    <span className={`gate-badge ${skipped ? 'skip' : 'analyze'}`} title={t('service.gate.tooltip', { id: gate.analysisId })}>
      {skipped ? <Zap size={12} /> : <Layers size={12} />}
      <span>{label}</span>
    </span>
  );
}
