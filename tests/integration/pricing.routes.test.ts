import request from 'supertest';
import app from '../../src/app';
import { SettingsModel } from '../../src/db/models';

describe('Pricing & Settings HTTP Endpoints Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/settings and GET /settings', () => {
    it('returns public settings document successfully', async () => {
      jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          base_delivery_fee: 50,
          cost_per_kg: 20,
          rider_commission_percentage: 15,
        }),
      } as any);

      const res = await request(app).get('/public/settings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.settings.base_delivery_fee).toBe(50);
      expect(res.body.settings.cost_per_kg).toBe(20);
    });

    it('works with the /settings alias', async () => {
      jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          base_delivery_fee: 60,
          cost_per_kg: 25,
          rider_commission_percentage: 18,
        }),
      } as any);

      const res = await request(app).get('/settings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.settings.base_delivery_fee).toBe(60);
    });
  });

  describe('POST /pricing/calculate and POST /parcels/calculate-cost', () => {
    it('calculates cost via POST /pricing/calculate for 3kg on bike', async () => {
      jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          base_delivery_fee: 50,
          cost_per_kg: 20,
          rider_commission_percentage: 15,
        }),
      } as any);

      const res = await request(app)
        .post('/pricing/calculate')
        .send({ weight: 3, requiredVehicle: 'bike' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cost).toBe(90);
      expect(res.body.data.totalCost).toBe(90);
      expect(res.body.data.riderEarning).toBe(13.5);
      expect(res.body.data.adminProfit).toBe(76.5);
    });

    it('calculates cost via POST /parcels/calculate-cost with vehicleType alias', async () => {
      jest.spyOn(SettingsModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          base_delivery_fee: 50,
          cost_per_kg: 20,
          rider_commission_percentage: 15,
        }),
      } as any);

      const res = await request(app)
        .post('/parcels/calculate-cost')
        .send({ weight: 2, vehicleType: 'car' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.cost).toBe(105);
      expect(res.body.data.totalCost).toBe(105);
    });
  });
});
