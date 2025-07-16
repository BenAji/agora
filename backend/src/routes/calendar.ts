import express from 'express';
import { supabase, UserRole } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/calendar - Get calendar grid data
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      gicsSector, 
      eventType, 
      followedCompanies 
    } = req.query;

    // Default to current month if no date range provided
    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    // Build event query
    let eventQuery = supabase
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
      .gte('startDate', start.toISOString())
      .lte('startDate', end.toISOString())
      .order('startDate', { ascending: true });

    if (gicsSector) {
      eventQuery = eventQuery.eq('gicsSector', gicsSector);
    }
    if (eventType) {
      eventQuery = eventQuery.eq('eventType', eventType);
    }
    
    // Handle followed companies filter
    if (followedCompanies && typeof followedCompanies === 'string') {
      const companyList = followedCompanies.split(',');
      eventQuery = eventQuery.in('tickerSymbol', companyList);
    }

    const { data: events, error: eventsError } = await eventQuery;

    if (eventsError) {
      console.error('Get events error:', eventsError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Get all companies for the Y-axis
    const { data: gicsCompanies, error: companiesError } = await supabase
      .from('gics_companies')
      .select('*')
      .order('companyName', { ascending: true });

    if (companiesError) {
      console.error('Get companies error:', companiesError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Group events by company and date
    const calendarData = gicsCompanies?.map((company: any) => {
      const companyEvents = events?.filter((event: any) => 
        event.tickerSymbol === company.tickerSymbol ||
        event.gicsCompany?.tickerSymbol === company.tickerSymbol
      ) || [];

      // Group events by date
      const eventsByDate: { [key: string]: any[] } = {};
      companyEvents.forEach((event: any) => {
        const dateKey = new Date(event.startDate).toISOString().split('T')[0];
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push({
          ...event,
          userRsvp: event.rsvps?.find((rsvp: any) => rsvp.userID === req.user?.userID)
        });
      });

      return {
        company: {
          tickerSymbol: company.tickerSymbol,
          companyName: company.companyName,
          gicsSector: company.gicsSector,
          gicsSubCategory: company.gicsSubCategory
        },
        events: eventsByDate
      };
    }) || [];

    // Generate date grid for X-axis
    const dateGrid = [];
    const current = new Date(start);
    while (current <= end) {
      dateGrid.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Get user's subscriptions for filtering
    const { data: userSubscriptions, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('userID', req.user?.userID!)
      .eq('status', 'ACTIVE');

    if (subscriptionsError) {
      console.error('Get subscriptions error:', subscriptionsError);
    }

    // Statistics
    const totalEvents = events?.length || 0;
    const userRsvps = events?.reduce((count: number, event: any) => {
      return count + (event.rsvps?.filter((rsvp: any) => rsvp.userID === req.user?.userID).length || 0);
    }, 0) || 0;

    const eventsByType = events?.reduce((acc: { [key: string]: number }, event: any) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number }) || {};

    res.json({
      calendarData,
      dateGrid,
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      userSubscriptions: userSubscriptions || [],
      statistics: {
        totalEvents,
        userRsvps,
        eventsByType
      }
    });
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/calendar/week - Get week view
router.get('/week', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { date } = req.query;
    
    // Get start of week (Monday)
    const targetDate = date ? new Date(date as string) : new Date();
    const startOfWeek = new Date(targetDate);
    startOfWeek.setDate(targetDate.getDate() - targetDate.getDay() + 1);
    
    // Get end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const { data: events, error } = await supabase
      .from('events')
      .select(`
        *,
        gicsCompany:gics_companies!events_tickerSymbol_fkey(*),
        userCompany:user_companies!events_companyID_fkey(*),
        rsvps!inner(*)
      `)
      .gte('startDate', startOfWeek.toISOString())
      .lte('startDate', endOfWeek.toISOString())
      .eq('rsvps.userID', req.user?.userID!)
      .order('startDate', { ascending: true });

    if (error) {
      console.error('Get week events error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Group events by day
    const weekData = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      
      const dayEvents = events?.filter((event: any) => {
        const eventDate = new Date(event.startDate);
        return eventDate.toDateString() === currentDay.toDateString();
      }) || [];

      weekData.push({
        date: currentDay.toISOString().split('T')[0],
        dayName: currentDay.toLocaleDateString('en-US', { weekday: 'long' }),
        events: dayEvents
      });
    }

    res.json({
      weekData,
      weekRange: {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Get week calendar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
