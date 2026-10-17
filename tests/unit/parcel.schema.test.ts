import { parcelSchema, trackingSchema } from '../../src/modules/parcel/parcel.schema';

describe('Parcel & Tracking Zod Schemas', () => {
  describe('parcelSchema', () => {
    it('validates a correct parcel booking payload', () => {
      const validPayload = {
        body: {
          parcelName: 'Winter Garments',
          parcelType: 'Not-Document',
          weight: 2.5,
          receiverName: 'Karim Ahmed',
          receiverPhone: '01712345678',
          deliveryAddress: 'House 12, Road 4, Sector 7, Uttara',
          receiverDistrict: 'Dhaka',
          senderPhone: '01812345678',
          senderDistrict: 'Chittagong',
          senderName: 'Rahim Khan',
        },
      };

      const result = parcelSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid Bangladeshi phone number format', () => {
      const invalidPayload = {
        body: {
          parcelName: 'Electronics Box',
          weight: 1.0,
          receiverName: 'Karim Ahmed',
          receiverPhone: '123456', // Invalid BD number
          deliveryAddress: 'House 12, Road 4, Sector 7, Uttara',
          receiverDistrict: 'Dhaka',
        },
      };

      const result = parcelSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid Bangladeshi phone number');
      }
    });

    it('rejects zero or negative weight', () => {
      const invalidPayload = {
        body: {
          parcelName: 'Books',
          weight: -2,
          receiverName: 'Karim Ahmed',
          receiverPhone: '01912345678',
          deliveryAddress: 'House 12, Road 4, Sector 7, Uttara',
          receiverDistrict: 'Dhaka',
        },
      };

      const result = parcelSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('rejects missing receiver district', () => {
      const invalidPayload = {
        body: {
          parcelName: 'Books',
          weight: 1.5,
          receiverName: 'Karim Ahmed',
          receiverPhone: '01912345678',
          deliveryAddress: 'House 12, Road 4, Sector 7, Uttara',
          receiverDistrict: '',
        },
      };

      const result = parcelSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('trackingSchema', () => {
    it('validates correct tracking update', () => {
      const validPayload = {
        body: {
          trackingId: 'G2C-ABC12345',
          status: 'picked_up',
          details: 'Parcel received from sender by rider',
          location: 'Dhaka Central Hub',
        },
      };

      const result = trackingSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects missing trackingId or status', () => {
      const invalidPayload = {
        body: {
          details: 'Parcel received',
        },
      };

      const result = trackingSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });
});
