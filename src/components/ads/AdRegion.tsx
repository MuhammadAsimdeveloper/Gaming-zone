import type { AdPlacement } from '../../config/site';
import { isAdSlotConfigured } from '../../lib/ads';
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

  if (!isAdSlotConfigured(placement) || !isAdPlacementEnabled(placement)) return null;

  return (
    <Container className={className}>
      <AdSlot placement={placement} />
    </Container>
  );
}
