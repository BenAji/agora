import express from 'express';
import { supabase, UserRole, EventType } from '../lib/supabase';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/events - Get all events with filtering
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { 
      gicsSector, 
      eventType, 
      startDate, 
      endDate, 
      tickerSymbol,
      limit = '50',
      offset = '0'
    } = req.query;

    let query = supabase
      .from('events')
      .select(`
        *,
        gicsCompany:gics_companies!events_tickerSymbol_fkey(*),
        userCompany:user_companies!events_companyID_fkey(*),
        rsvps(
          *,
          user:users(userID, firstName, lastName, email, role)
        )
      `)
      .order('startDate', { ascending: true })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    // Apply filters
    if (gicsSector) {
      query = query.eq('gicsSector', gicsSector);
    }
    if (eventType) {
      query = query.eq('eventType', eventType);
    }
    if (tickerSymbol) {
      query = query.eq('tickerSymbol', tickerSymbol);
    }
    if (startDate) {
      query = query.gte('startDate', startDate);
    }
    if (endDate) {
      query = query.lte('startDate', endDate);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Get events error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    if (gicsSector) countQuery = countQuery.eq('gicsSector', gicsSector);
    if (eventType) countQuery = countQuery.eq('eventType', eventType);
    if (tickerSymbol) countQuery = countQuery.eq('tickerSymbol', tickerSymbol);
    if (startDate) countQuery = countQuery.gte('startDate', startDate);
    if (endDate) countQuery = countQuery.lte('startDate', endDate);

    const { count } = await countQuery;

    res.json({
      events,
      pagination: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (count || 0) > parseInt(offset as string) + parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id - Get single event
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const { data: event, error } = await supabase
      .from('events')
      .select(`
        *,
        gicsCompany:gics_companies!events_tickerSymbol_fkey(*),
        userCompany:user_companies!events_companyID_fkey(*),
        rsvps(
          *,
          user:users(userID, firstName, lastName, email, role)
        )
      `)
      .eq('eventID', id)
      .single();

    if (error || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events - Create new event (IR Admin only)
router.post('/', authenticateToken, requireRole(['IR_ADMIN']), async (req: AuthRequest, res) => {
  try {
    const {
      eventName,
      tickerSymbol,
      gicsSector,
      gicsSubSector,
      eventType,
      location,
      hostCompany,
      companyID,
      startDate,
      endDate,
      description
    } = req.body;

    // Validate required fields
    if (!eventName || !eventType || !startDate) {
      return res.status(400).json({ error: 'Event name, type, and start date are required' });
    }

    // Validate event type
    const validEventTypes: EventType[] = ['EARNINGS_CALL', 'INVESTOR_MEETING', 'CONFERENCE', 'ROADSHOW', 'ANALYST_DAY', 'PRODUCT_LAUNCH', 'OTHER'];
    if (!validEventTypes.includes(eventType as EventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    if (end && end <= start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        eventName,
        tickerSymbol: tickerSymbol || null,
        gicsSector: gicsSector || null,
        gicsSubSector: gicsSubSector || null,
        eventType: eventType as EventType,
        location: location || null,
        hostCompany: hostCompany || null,
        companyID: companyID || null,
        startDate: start.toISOString(),
        endDate: end ? end.toISOString() : null,
        description: description || null,
      })
      .select(`
        *,
        gicsCompany:gics_companies!events_tickerSymbol_fkey(*),
        userCompany:user_companies!events_companyID_fkey(*)
      `)
      .single();

    if (error) {
      console.error('Create event error:', error);
      return res.status(500).json({ error: 'Failed to create event' });
    }

    res.status(201).json({
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:id - Update event (IR Admin only)
router.put('/:id', authenticateToken, requireRole(['IR_ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      eventName,
      tickerSymbol,
      gicsSector,
      gicsSubSector,
      eventType,
      location,
      hostCompany,
      companyID,
      startDate,
      endDate,
      description
    } = req.body;

    // Check if event exists
    const { data: existingEvent, error: checkError } = await supabase
      .from('events')
      .select('eventID')
      .eq('eventID', id)
      .single();

    if (checkError || !existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Validate event type if provided
    const validEventTypes: EventType[] = ['EARNINGS_CALL', 'INVESTOR_MEETING', 'CONFERENCE', 'ROADSHOW', 'ANALYST_DAY', 'PRODUCT_LAUNCH', 'OTHER'];
    if (eventType && !validEventTypes.includes(eventType as EventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    // Validate dates if provided
    let start, end;
    if (startDate) {
      start = new Date(startDate);
      end = endDate ? new Date(endDate) : null;
      if (end && end <= start) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }
    }

    // Build update object
    const updateData: any = {};
    if (eventName !== undefined) updateData.eventName = eventName;
    if (tickerSymbol !== undefined) updateData.tickerSymbol = tickerSymbol;
    if (gicsSector !== undefined) updateData.gicsSector = gicsSector;
    if (gicsSubSector !== undefined) updateData.gicsSubSector = gicsSubSector;
    if (eventType !== undefined) updateData.eventType = eventType;
    if (location !== undefined) updateData.location = location;
    if (hostCompany !== undefined) updateData.hostCompany = hostCompany;
    if (companyID !== undefined) updateData.companyID = companyID;
    if (startDate !== undefined) updateData.startDate = start?.toISOString();
    if (endDate !== undefined) updateData.endDate = end ? end.toISOString() : null;
    if (description !== undefined) updateData.description = description;

    const { data: event, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('eventID', id)
      .select(`
        *,
        gicsCompany:gics_companies!events_tickerSymbol_fkey(*),
        userCompany:user_companies!events_companyID_fkey(*)
      `)
      .single();

    if (error) {
      console.error('Update event error:', error);
      return res.status(500).json({ error: 'Failed to update event' });
    }

    res.json({
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/events/:id - Delete event (IR Admin only)
router.delete('/:id', authenticateToken, requireRole(['IR_ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if event exists
    const { data: existingEvent, error: checkError } = await supabase
      .from('events')
      .select('eventID')
      .eq('eventID', id)
      .single();

    if (checkError || !existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('eventID', id);

    if (error) {
      console.error('Delete event error:', error);
      return res.status(500).json({ error: 'Failed to delete event' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
