import { Request, Response } from 'express';
import { PublicService } from './public.service';
import { uploadToCloudinary } from '../../utils/upload';
import { catchAsync } from '../../utils/catchAsync';

export const getPublicSettings = catchAsync(async (_req: Request, res: Response) => {
  const settings = await PublicService.getPublicSettings();
  res.send({ success: true, settings });
});

export const getPublicTracking = catchAsync(async (req: Request, res: Response) => {
  const { trackingId } = req.params;
  const history = await PublicService.getPublicTracking(trackingId as string);
  res.send({ success: true, history });
});

export const getProcessSteps = catchAsync(async (req: Request, res: Response) => {
  const showAll = req.query.all === 'true';
  const steps = await PublicService.getProcessSteps(showAll);
  res.send({ success: true, data: steps });
});

export const getLandingConfig = catchAsync(async (_req: Request, res: Response) => {
  const config = await PublicService.getLandingConfig();
  res.send({ success: true, data: config });
});

export const updateLandingConfig = catchAsync(async (req: Request, res: Response) => {
  const update = req.body;
  delete update._id;

  // If an OG image file was uploaded, push it to Cloudinary and store the URL
  if (req.file) {
    update.seo = update.seo || {};
    update.seo.image = await uploadToCloudinary(req.file, 'gram2city/config');
  }

  await PublicService.updateLandingConfig(update);
  res.send({ success: true, message: 'Configuration updated' });
});

export const getBanners = catchAsync(async (req: Request, res: Response) => {
  const showAll = req.query.all === 'true';
  const banners = await PublicService.getBanners(showAll);
  res.send({ success: true, data: banners });
});

export const getServices = catchAsync(async (req: Request, res: Response) => {
  const showAll = req.query.all === 'true';
  const services = await PublicService.getServices(showAll);
  res.send({ success: true, data: services });
});

export const getFeatures = catchAsync(async (req: Request, res: Response) => {
  const showAll = req.query.all === 'true';
  const features = await PublicService.getFeatures(showAll);
  res.send({ success: true, data: features });
});

export const getPartners = catchAsync(async (req: Request, res: Response) => {
  const showAll = req.query.all === 'true';
  const partners = await PublicService.getPartners(showAll);
  res.send({ success: true, data: partners });
});

export const getTestimonials = catchAsync(async (req: Request, res: Response) => {
  const showAll = req.query.all === 'true';
  const testimonials = await PublicService.getTestimonials(showAll);
  res.send({ success: true, data: testimonials });
});

export const getStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await PublicService.getStats();
  res.send({ success: true, data: stats });
});

export const subscribeNewsletter = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).send({ success: false, message: 'Invalid email address' });
  }

  const result = await PublicService.subscribeNewsletter(email);
  if (!result.success) {
    return res.status(400).send(result);
  }
  res.send(result);
});

export const getNewsletterSubscribers = catchAsync(async (_req: Request, res: Response) => {
  const subscribers = await PublicService.getNewsletterSubscribers();
  res.send({ success: true, data: subscribers });
});

export const getWarehouses = catchAsync(async (req: Request, res: Response) => {
  const { search, district, status } = req.query;
  const data = await PublicService.getWarehouses({
    search: search as string,
    district: district as string,
    status: status as string,
  });
  res.send({ success: true, data });
});

// Merchant controllers
export const applyMerchant = catchAsync(async (req: Request, res: Response) => {
  const { businessName, businessType, tradeLicense, address, district, phone } = req.body;
  const email = req.user?.email as string;

  if (!email) {
    return res.status(400).send({ success: false, message: 'User email not found in token.' });
  }

  const result = await PublicService.applyMerchant({
    email,
    businessName,
    businessType,
    tradeLicense,
    address,
    district,
    phone,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  if (!result.success) {
    return res.status(400).send(result);
  }

  res.status(201).send(result);
});

export const getMerchantProfile = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email as string;
  const merchant = await PublicService.getMerchantProfile(email);
  if (!merchant) {
    return res.status(404).send({ success: false, message: 'Merchant profile not found.' });
  }
  res.send({ success: true, data: merchant });
});

export const getMerchantStats = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email as string;
  const stats = await PublicService.getMerchantStats(email);
  if (!stats) {
    return res.status(404).send({ success: false, message: 'Merchant not found' });
  }
  res.send({ success: true, stats });
});

// Generic Landing Item Operations
const getModuleNameAndField = (path: string) => {
  const cleanPath = path.replace(/^\//, '');
  const parts = cleanPath.split('/');
  const moduleName = parts[0] === 'landing' ? parts[1] : parts[0];
  const imageField =
    moduleName === 'process-steps' ? undefined : moduleName === 'partners' ? 'logo' : 'image';
  return { moduleName, imageField };
};

export const createLandingItem = catchAsync(async (req: Request, res: Response) => {
  const { moduleName, imageField } = getModuleNameAndField(req.path);
  const item = req.body;

  if (imageField && req.file) {
    const folder = `gram2city/${moduleName}`;
    item[imageField] = await uploadToCloudinary(req.file, folder);
  }

  const result = await PublicService.createLandingItem(moduleName, item);
  res.send({ success: true, data: { ...item, _id: result.insertedId } });
});

export const updateLandingItem = catchAsync(async (req: Request, res: Response) => {
  const { moduleName, imageField } = getModuleNameAndField(req.path);
  const { id } = req.params;
  const update = req.body;
  delete update._id;

  if (imageField && req.file) {
    const folder = `gram2city/${moduleName}`;
    update[imageField] = await uploadToCloudinary(req.file, folder);
  }

  const result = await PublicService.updateLandingItem(moduleName, id as string, update);
  if (result.matchedCount === 0) {
    return res.status(404).send({ success: false, message: 'Not found' });
  }
  res.send({ success: true, message: 'Item updated' });
});

export const deleteLandingItem = catchAsync(async (req: Request, res: Response) => {
  const { moduleName } = getModuleNameAndField(req.path);
  const { id } = req.params;
  const result = await PublicService.deleteLandingItem(moduleName, id as string);
  if (result.deletedCount === 0) {
    return res.status(404).send({ success: false, message: 'Not found' });
  }
  res.send({ success: true, message: 'Item deleted' });
});
