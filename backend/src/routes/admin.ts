import { Router } from 'express';
import {
  getDashboard, getUsers, suspendUser, createUser, updateUser, deleteUser,
  getPendingListings, reviewListing,
  getPendingJobs, reviewJob,
  getPendingOrganizations, verifyOrganization,
  getCoupons, createCoupon, toggleCoupon,
  getRevenueReport, createSystemAnnouncement,
  getCvStats, getCvUsers, getActivityFeed,
} from '../controllers/adminController';
import {
  getUserDetail, updateProfile,
  getAllListings, updateListing, deleteListing, getListingApplications,
  getAllJobs, updateJob, deleteJob, getJobApplications, updateApplicationStatus,
  getAllOrganizations, getReviews, deleteReview, dismissReviewReport,
  getPayments, getAnnouncements, getSettingsAdmin, updateSettings,
} from '../controllers/adminManageController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboard);
router.get('/cv/stats', getCvStats);
router.get('/cv/users', getCvUsers);
router.get('/cv/activity', getActivityFeed);
router.get('/users', getUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);
router.patch('/users/:id/suspend', suspendUser);
router.delete('/users/:id', deleteUser);

router.get('/listings/pending', getPendingListings);
router.patch('/listings/:id/review', reviewListing);

router.get('/jobs/pending', getPendingJobs);
router.patch('/jobs/:id/review', reviewJob);

router.get('/organizations/pending', getPendingOrganizations);
router.patch('/organizations/:id/verify', verifyOrganization);

router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.patch('/coupons/:id/toggle', toggleCoupon);

router.get('/revenue', getRevenueReport);
router.post('/announcements', createSystemAnnouncement);


// ── full management (adminManageController) ──
router.get('/users/:id', getUserDetail);
router.patch('/profiles/:kind/:id', updateProfile);

router.get('/listings', getAllListings);
router.patch('/listings/:id', updateListing);
router.delete('/listings/:id', deleteListing);
router.get('/listings/:id/applications', getListingApplications);

router.get('/jobs', getAllJobs);
router.patch('/jobs/:id', updateJob);
router.delete('/jobs/:id', deleteJob);
router.get('/jobs/:id/applications', getJobApplications);

router.patch('/applications/:kind/:id', updateApplicationStatus);

router.get('/organizations', getAllOrganizations);

router.get('/reviews', getReviews);
router.delete('/reviews/:id', deleteReview);
router.patch('/reviews/:id/dismiss', dismissReviewReport);

router.get('/payments', getPayments);
router.get('/announcements', getAnnouncements);

router.get('/settings', getSettingsAdmin);
router.put('/settings', updateSettings);

export default router;
