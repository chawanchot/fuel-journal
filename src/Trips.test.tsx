import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Trips from './Trips';
import type { Trip } from './types';

const handlers = { busy: false, onAdd: () => {}, onEdit: () => {}, onDelete: () => {} };

describe('trip view with pre-trip application state', () => {
  it('renders an empty state when the trip collection has not been initialized', () => {
    const html = renderToStaticMarkup(<Trips {...handlers} />);
    expect(html).toContain('ทริปของเรา');
    expect(html).toContain('เพิ่มทริปแรก');
  });

  it('renders the same empty state for undefined and an empty array', () => {
    expect(renderToStaticMarkup(<Trips {...handlers} trips={undefined} />))
      .toBe(renderToStaticMarkup(<Trips {...handlers} trips={[]} />));
  });

  it('preserves and renders existing trip records', () => {
    const trip: Trip = {
      id: 't1', vehicleId: 'v1', name: 'เที่ยวเขาใหญ่',
      startDate: '2026-01-01', endDate: '2026-01-01',
      distanceMode: 'distance', distanceKm: 120,
      fuelMode: 'estimated', efficiencyKmPerLitre: 15, efficiencySource: 'manual',
      extrasSatang: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    const vehicle = { id: 'v1', name: 'รถเที่ยว', type: 'car' as const, fuelType: 'E20', createdAt: trip.createdAt, updatedAt: trip.updatedAt };
    const html = renderToStaticMarkup(<Trips {...handlers} vehicle={vehicle} trips={[trip]} />);
    expect(html).toContain('เที่ยวเขาใหญ่');
    expect(html).toContain('8.00');
    expect(html).not.toContain('เพิ่มทริปแรก');
  });
});
