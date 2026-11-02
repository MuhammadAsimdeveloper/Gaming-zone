import type { AdPlacement } from '../../config/site';
import { isAdSlotConfigured } from '../../lib/ads';
import { useConsent } from '../../lib/useConsent';
import { useCatalogue } from '../../providers/CatalogueProvider';
import { Container } from '../ui/Container';
import { AdSlot } from './AdSlot';

export function AdRegion({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const { isAdPlacementEnabled } = useCatalogue();
  const { advertising } = useConsent();

  if (!isAdSlotConfigured(placement, advertising) || !isAdPlacementEnabled(placement)) return null;

  return (
    <Container className={className}>
      <AdSlot placement={placement} />
    </Container>
  );
}
