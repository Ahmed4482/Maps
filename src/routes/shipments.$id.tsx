import { createFileRoute } from '@tanstack/react-router';
import { ShipmentDetailPage } from '../pages/ShipmentDetailPage';

export const Route = createFileRoute('/shipments/$id')({
  component: ShipmentDetailPage,
});
