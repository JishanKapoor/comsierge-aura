import express from 'express';
import Reminder from '../models/Reminder.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get all reminders for a user
router.get('/', async (req, res) => {
  try {
    const { userId, completed, upcoming } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const query = { userId: new mongoose.Types.ObjectId(userId) };

    // Filter by completion status
    if (completed === 'true') {
      query.isCompleted = true;
    } else if (completed === 'false') {
      query.isCompleted = false;
    }

    // Filter for upcoming reminders (not completed, scheduled for the future)
    if (upcoming === 'true') {
      query.isCompleted = false;
      query.scheduledAt = { $gte: new Date() };
    }

    const reminders = await Reminder.find(query)
      .sort({ scheduledAt: 1 })
      .populate('contactId', 'name phone');

    // Format for frontend
    const formattedReminders = reminders.map(r => ({
      id: r._id.toString(),
      type: r.type,
      title: r.title,
      description: r.description,
      datetime: formatDateTime(r.scheduledAt),
      scheduledAt: r.scheduledAt,
      contactId: r.contactId?._id?.toString(),
      contactName: r.contactName || r.contactId?.name,
      contactPhone: r.contactPhone || r.contactId?.phone,
      isCompleted: r.isCompleted,
      completedAt: r.completedAt,
      recurrence: r.recurrence,
      createdAt: r.createdAt
    }));

    res.json(formattedReminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new reminder
router.post('/', async (req, res) => {
  try {
    const { userId, type, title, description, scheduledAt, contactId, contactPhone, contactName, recurrence } = req.body;

    if (!userId || !title || !scheduledAt) {
      return res.status(400).json({ error: 'userId, title, and scheduledAt are required' });
    }

    const reminder = new Reminder({
      userId: new mongoose.Types.ObjectId(userId),
      type: type || 'personal',
      title,
      description,
      scheduledAt: new Date(scheduledAt),
      contactId: contactId ? new mongoose.Types.ObjectId(contactId) : undefined,
      contactPhone,
      contactName,
      recurrence: recurrence || 'none'
    });

    await reminder.save();

    res.status(201).json({
      id: reminder._id.toString(),
      type: reminder.type,
      title: reminder.title,
      description: reminder.description,
      datetime: formatDateTime(reminder.scheduledAt),
      scheduledAt: reminder.scheduledAt,
      contactId: reminder.contactId?.toString(),
      contactName: reminder.contactName,
      contactPhone: reminder.contactPhone,
      isCompleted: reminder.isCompleted,
      recurrence: reminder.recurrence,
      createdAt: reminder.createdAt
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a reminder
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle completion
    if (updates.isCompleted === true) {
      updates.completedAt = new Date();
    }

    // Convert date strings to Date objects
    if (updates.scheduledAt) {
      updates.scheduledAt = new Date(updates.scheduledAt);
    }

    const reminder = await Reminder.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    res.json({
      id: reminder._id.toString(),
      type: reminder.type,
      title: reminder.title,
      description: reminder.description,
      datetime: formatDateTime(reminder.scheduledAt),
      scheduledAt: reminder.scheduledAt,
      contactId: reminder.contactId?.toString(),
      contactName: reminder.contactName,
      contactPhone: reminder.contactPhone,
      isCompleted: reminder.isCompleted,
      completedAt: reminder.completedAt,
      recurrence: reminder.recurrence,
      createdAt: reminder.createdAt
    });
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a reminder
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Reminder.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark reminder as completed
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    const reminder = await Reminder.findByIdAndUpdate(
      id,
      { 
        $set: { 
          isCompleted: true, 
          completedAt: new Date() 
        } 
      },
      { new: true }
    );

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Handle recurring reminders
    if (reminder.recurrence !== 'none') {
      const nextDate = calculateNextOccurrence(reminder.scheduledAt, reminder.recurrence);
      
      const newReminder = new Reminder({
        userId: reminder.userId,
        type: reminder.type,
        title: reminder.title,
        description: reminder.description,
        scheduledAt: nextDate,
        contactId: reminder.contactId,
        contactPhone: reminder.contactPhone,
        contactName: reminder.contactName,
        recurrence: reminder.recurrence
      });
      
      await newReminder.save();
    }

    res.json({
      id: reminder._id.toString(),
      isCompleted: reminder.isCompleted,
      completedAt: reminder.completedAt
    });
  } catch (error) {
    console.error('Error completing reminder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get due reminders (for notifications)
router.get('/due', async (req, res) => {
  try {
    const now = new Date();
    const inFiveMinutes = new Date(now.getTime() + 5 * 60 * 1000);

    const dueReminders = await Reminder.find({
      isCompleted: false,
      notificationSent: false,
      scheduledAt: { $lte: inFiveMinutes }
    }).populate('contactId', 'name phone');

    res.json(dueReminders.map(r => ({
      id: r._id.toString(),
      type: r.type,
      title: r.title,
      scheduledAt: r.scheduledAt,
      contactName: r.contactName || r.contactId?.name
    })));
  } catch (error) {
    console.error('Error fetching due reminders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as sent
router.post('/:id/notified', async (req, res) => {
  try {
    const { id } = req.params;
    
    await Reminder.findByIdAndUpdate(id, { notificationSent: true });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to format date/time
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const options = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return d.toLocaleString('en-US', options);
}

// Helper function to calculate next occurrence for recurring reminders
function calculateNextOccurrence(currentDate, recurrence) {
  const next = new Date(currentDate);
  
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
  }
  
  return next;
}

export default router;
