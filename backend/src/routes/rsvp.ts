import express from 'express';
import { supabase, RSVPStatus } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// POST /api/rsvp - Create or update RSVP
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { eventID, status } = req.body;
    const userID = req.user?.userID;

    if (!eventID || !status) {
      return res.status(400).json({ error: 'Event ID and status are required' });
    }

    // Validate status
    const validStatuses: RSVPStatus[] = ['ACCEPTED', 'DECLINED', 'TENTATIVE', 'PENDING'];
    if (!validStatuses.includes(status as RSVPStatus)) {
      return res.status(400).json({ error: 'Invalid RSVP status' });
    }

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        *,
        gicsCompany:gics_companies!events_tickerSymbol_fkey(*)
      `)
      .eq('eventID', eventID)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if RSVP already exists
    const { data: existingRSVP, error: rsvpCheckError } = await supabase
      .from('rsvps')
      .select('rsvpID')
      .eq('userID', userID!)
      .eq('eventID', eventID)
      .single();

    let rsvp;
    if (existingRSVP && !rsvpCheckError) {
      // Update existing RSVP
      const { data: updatedRSVP, error: updateError } = await supabase
        .from('rsvps')
        .update({ status: status as RSVPStatus })
        .eq('userID', userID!)
        .eq('eventID', eventID)
        .select(`
          *,
          user:users(userID, firstName, lastName, email, role),
          event:events(
            *,
            gicsCompany:gics_companies!events_tickerSymbol_fkey(*)
          )
        `)
        .single();

      if (updateError) {
        console.error('Update RSVP error:', updateError);
        return res.status(500).json({ error: 'Failed to update RSVP' });
      }

      rsvp = updatedRSVP;
    } else {
      // Create new RSVP
      const { data: newRSVP, error: createError } = await supabase
        .from('rsvps')
        .insert({
          userID: userID!,
          eventID,
          status: status as RSVPStatus
        })
        .select(`
          *,
          user:users(userID, firstName, lastName, email, role),
          event:events(
            *,
            gicsCompany:gics_companies!events_tickerSymbol_fkey(*)
          )
        `)
        .single();

      if (createError) {
        console.error('Create RSVP error:', createError);
        return res.status(500).json({ error: 'Failed to create RSVP' });
      }

      rsvp = newRSVP;
    }

    res.json({
      message: existingRSVP ? 'RSVP updated successfully' : 'RSVP created successfully',
      rsvp
    });
  } catch (error) {
    console.error('RSVP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rsvp/user/:userID - Get user's RSVPs
router.get('/user/:userID', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userID } = req.params;
    const requestingUser = req.user?.userID;

    // Users can only view their own RSVPs unless they're managers
    if (userID !== requestingUser && req.user?.role !== 'ANALYST_MANAGER' && req.user?.role !== 'IR_ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { data: rsvps, error } = await supabase
      .from('rsvps')
      .select(`
        *,
        event:events(
          *,
          gicsCompany:gics_companies!events_tickerSymbol_fkey(*),
          userCompany:user_companies!events_companyID_fkey(*)
        )
      `)
      .eq('userID', userID)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Get user RSVPs error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(rsvps);
  } catch (error) {
    console.error('Get user RSVPs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rsvp/event/:eventID - Get event RSVPs
router.get('/event/:eventID', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { eventID } = req.params;
    const { status } = req.query;

    let query = supabase
      .from('rsvps')
      .select(`
        *,
        user:users(
          userID, firstName, lastName, email, role,
          company:user_companies(companyName, location)
        )
      `)
      .eq('eventID', eventID)
      .order('createdAt', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: rsvps, error } = await query;

    if (error) {
      console.error('Get event RSVPs error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Group RSVPs by status
    const rsvpsByStatus = rsvps?.reduce((acc: { [key: string]: any[] }, rsvp: any) => {
      if (!acc[rsvp.status]) acc[rsvp.status] = [];
      acc[rsvp.status].push(rsvp);
      return acc;
    }, {} as { [key: string]: any[] }) || {};

    // Calculate statistics
    const statistics = {
      total: rsvps?.length || 0,
      accepted: rsvpsByStatus.ACCEPTED?.length || 0,
      declined: rsvpsByStatus.DECLINED?.length || 0,
      tentative: rsvpsByStatus.TENTATIVE?.length || 0,
      pending: rsvpsByStatus.PENDING?.length || 0
    };

    res.json({
      rsvps,
      rsvpsByStatus,
      statistics
    });
  } catch (error) {
    console.error('Get event RSVPs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rsvp/:eventID - Delete RSVP
router.delete('/:eventID', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { eventID } = req.params;
    const userID = req.user?.userID;

    const { data: rsvp, error: findError } = await supabase
      .from('rsvps')
      .select('rsvpID')
      .eq('userID', userID!)
      .eq('eventID', eventID)
      .single();

    if (findError || !rsvp) {
      return res.status(404).json({ error: 'RSVP not found' });
    }

    const { error: deleteError } = await supabase
      .from('rsvps')
      .delete()
      .eq('userID', userID!)
      .eq('eventID', eventID);

    if (deleteError) {
      console.error('Delete RSVP error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete RSVP' });
    }

    res.json({ message: 'RSVP deleted successfully' });
  } catch (error) {
    console.error('Delete RSVP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
