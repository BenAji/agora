import express from 'express';
import { supabase, SubscriptionStatus } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/subscriptions - Get user's subscriptions
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userID = req.user?.userID;
    const { status } = req.query;

    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        user:users(userID, firstName, lastName, email, role)
      `)
      .eq('userID', userID!)
      .order('createdAt', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error('Get subscriptions error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/subscriptions - Create new subscription
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { gicsSector, gicsSubCategory, subEnd } = req.body;
    const userID = req.user?.userID;

    if (!gicsSector) {
      return res.status(400).json({ error: 'GICS sector is required' });
    }

    // Check if similar subscription already exists
    const { data: existingSubscriptions, error: checkError } = await supabase
      .from('subscriptions')
      .select('subID')
      .eq('userID', userID!)
      .eq('gicsSector', gicsSector)
      .eq('gicsSubCategory', gicsSubCategory || null)
      .eq('status', 'ACTIVE')
      .limit(1);

    if (checkError) {
      console.error('Check subscription error:', checkError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingSubscriptions && existingSubscriptions.length > 0) {
      return res.status(409).json({ error: 'Similar active subscription already exists' });
    }

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert({
        userID: userID!,
        gicsSector,
        gicsSubCategory: gicsSubCategory || null,
        subStart: new Date().toISOString(),
        subEnd: subEnd ? new Date(subEnd).toISOString() : null,
        status: 'ACTIVE' as SubscriptionStatus
      })
      .select(`
        *,
        user:users(userID, firstName, lastName, email, role)
      `)
      .single();

    if (error) {
      console.error('Create subscription error:', error);
      return res.status(500).json({ error: 'Failed to create subscription' });
    }

    res.status(201).json({
      message: 'Subscription created successfully',
      subscription
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/subscriptions/:id - Update subscription
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { gicsSector, gicsSubCategory, subEnd, status } = req.body;
    const userID = req.user?.userID;

    // Check if subscription exists and belongs to user
    const { data: existingSubscription, error: checkError } = await supabase
      .from('subscriptions')
      .select('userID')
      .eq('subID', id)
      .single();

    if (checkError || !existingSubscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (existingSubscription.userID !== userID) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Validate status if provided
    const validStatuses: SubscriptionStatus[] = ['ACTIVE', 'INACTIVE', 'EXPIRED'];
    if (status && !validStatuses.includes(status as SubscriptionStatus)) {
      return res.status(400).json({ error: 'Invalid subscription status' });
    }

    // Build update object
    const updateData: any = {};
    if (gicsSector !== undefined) updateData.gicsSector = gicsSector;
    if (gicsSubCategory !== undefined) updateData.gicsSubCategory = gicsSubCategory;
    if (subEnd !== undefined) updateData.subEnd = subEnd ? new Date(subEnd).toISOString() : null;
    if (status !== undefined) updateData.status = status;

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('subID', id)
      .select(`
        *,
        user:users(userID, firstName, lastName, email, role)
      `)
      .single();

    if (error) {
      console.error('Update subscription error:', error);
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    res.json({
      message: 'Subscription updated successfully',
      subscription
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/subscriptions/:id - Delete subscription
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userID = req.user?.userID;

    // Check if subscription exists and belongs to user
    const { data: existingSubscription, error: checkError } = await supabase
      .from('subscriptions')
      .select('userID')
      .eq('subID', id)
      .single();

    if (checkError || !existingSubscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (existingSubscription.userID !== userID) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('subID', id);

    if (error) {
      console.error('Delete subscription error:', error);
      return res.status(500).json({ error: 'Failed to delete subscription' });
    }

    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('Delete subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/subscriptions/sectors - Get available GICS sectors
router.get('/sectors', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { data: sectors, error } = await supabase
      .from('gics_companies')
      .select('gicsSector, gicsSubCategory')
      .order('gicsSector')
      .order('gicsSubCategory');

    if (error) {
      console.error('Get sectors error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Group by sector
    const sectorMap: { [key: string]: Set<string> } = {};
    sectors?.forEach((item: any) => {
      if (!sectorMap[item.gicsSector]) {
        sectorMap[item.gicsSector] = new Set();
      }
      sectorMap[item.gicsSector].add(item.gicsSubCategory);
    });

    // Convert to array format
    const sectorsList = Object.keys(sectorMap).map(sector => ({
      sector,
      subCategories: Array.from(sectorMap[sector])
    }));

    res.json(sectorsList);
  } catch (error) {
    console.error('Get sectors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
