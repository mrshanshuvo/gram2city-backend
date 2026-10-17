import { ParcelService } from '../../src/modules/parcel/parcel.service';
import { SettingsModel } from '../../src/db/models';

describe('ParcelService.calculateCost (Pricing Engine)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates standard bike delivery for base weight (1kg)', async () => {
    jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        base_delivery_fee: 50,
        cost_per_kg: 20,
        rider_commission_percentage: 15,
      }),
    } as any);

    const result = await ParcelService.calculateCost(1, 'bike');

    expect(result.totalCost).toBe(50);
    expect(result.riderEarning).toBe(7.5);
    expect(result.adminProfit).toBe(42.5);
  });

  it('adds cost_per_kg surcharge for weight exceeding 1kg', async () => {
    jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        base_delivery_fee: 50,
        cost_per_kg: 20,
        rider_commission_percentage: 15,
      }),
    } as any);

    // 4kg -> 50 + (4 - 1) * 20 = 50 + 60 = 110
    const result = await ParcelService.calculateCost(4, 'bike');

    expect(result.totalCost).toBe(110);
    expect(result.riderEarning).toBe((110 * 15) / 100);
    expect(result.adminProfit).toBe(110 - (110 * 15) / 100);
  });

  it('applies car vehicle multiplier (1.5x)', async () => {
    jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        base_delivery_fee: 50,
        cost_per_kg: 20,
        rider_commission_percentage: 15,
      }),
    } as any);

    // 2kg -> (50 + 1 * 20) * 1.5 = 70 * 1.5 = 105
    const result = await ParcelService.calculateCost(2, 'car');

    expect(result.totalCost).toBe(105);
    expect(result.riderEarning).toBe((105 * 15) / 100);
    expect(result.adminProfit).toBe(105 - (105 * 15) / 100);
  });

  it('applies mini_pickup vehicle multiplier (2.2x)', async () => {
    jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        base_delivery_fee: 50,
        cost_per_kg: 20,
        rider_commission_percentage: 15,
      }),
    } as any);

    // 3kg -> (50 + 2 * 20) * 2.2 = 90 * 2.2 = 198
    const result = await ParcelService.calculateCost(3, 'mini_pickup');

    expect(result.totalCost).toBe(198);
  });

  it('applies large_pickup vehicle multiplier (3.5x)', async () => {
    jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        base_delivery_fee: 50,
        cost_per_kg: 20,
        rider_commission_percentage: 15,
      }),
    } as any);

    // 10kg -> (50 + 9 * 20) * 3.5 = 230 * 3.5 = 805
    const result = await ParcelService.calculateCost(10, 'large_pickup');

    expect(result.totalCost).toBe(805);
  });

  it('falls back to default parameters when system settings document is missing', async () => {
    jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    } as any);

    // Default baseFee: 50, default cost_per_kg: 20
    const result = await ParcelService.calculateCost(2, 'bike');

    expect(result.totalCost).toBe(70);
    expect(result.riderEarning).toBe(10.5);
  });

  it('respects dynamic custom admin settings values', async () => {
    jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        base_delivery_fee: 80,
        cost_per_kg: 35,
        rider_commission_percentage: 25,
      }),
    } as any);

    // 3kg -> (80 + 2 * 35) * 1 = 150
    const result = await ParcelService.calculateCost(3, 'bike');

    expect(result.totalCost).toBe(150);
    expect(result.riderEarning).toBe(37.5);
    expect(result.adminProfit).toBe(112.5);
  });
});
