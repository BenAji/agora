import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase, UserRole } from '../lib/supabase';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// POST /api/signup
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, role, companyID, managerID } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !username || !email || !password || !role) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Check if user already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('userID')
      .or(`username.eq.${username},email.eq.${email}`)
      .limit(1);

    if (checkError) {
      console.error('Database error:', checkError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'User with this username or email already exists' });
    }

    // Validate role
    const validRoles: UserRole[] = ['IR_ADMIN', 'ANALYST_MANAGER', 'INVESTMENT_ANALYST'];
    if (!validRoles.includes(role as UserRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: user, error: createError } = await supabase
      .from('users')
      .insert({
        firstName,
        lastName,
        username,
        email,
        password: hashedPassword,
        role: role as UserRole,
        companyID: companyID || null,
        managerID: managerID || null,
      })
      .select('userID, firstName, lastName, username, email, role, companyID, managerID, createdAt')
      .single();

    if (createError) {
      console.error('Create user error:', createError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userID: user.userID, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username or email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${username},email.eq.${username}`)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user company if exists
    let company = null;
    if (user.companyID) {
      const { data: companyData } = await supabase
        .from('user_companies')
        .select('companyName, location')
        .eq('companyID', user.companyID)
        .single();
      company = companyData;
    }

    // Get manager if exists
    let manager = null;
    if (user.managerID) {
      const { data: managerData } = await supabase
        .from('users')
        .select('userID, firstName, lastName, email')
        .eq('userID', user.managerID)
        .single();
      manager = managerData;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userID: user.userID, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Remove password from response and add related data
    const { password: _, ...userWithoutPassword } = user;
    const userResponse = {
      ...userWithoutPassword,
      company,
      manager
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/me - Get current user profile
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userID = req.user?.userID;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('userID, firstName, lastName, username, email, role, companyID, managerID, createdAt, updatedAt')
      .eq('userID', userID!)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user company if exists
    let company = null;
    if (user.companyID) {
      const { data: companyData } = await supabase
        .from('user_companies')
        .select('companyName, location')
        .eq('companyID', user.companyID)
        .single();
      company = companyData;
    }

    // Get manager if exists
    let manager = null;
    if (user.managerID) {
      const { data: managerData } = await supabase
        .from('users')
        .select('userID, firstName, lastName, email')
        .eq('userID', user.managerID)
        .single();
      manager = managerData;
    }

    const userResponse = {
      ...user,
      company,
      manager
    };

    res.json({
      user: userResponse
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
