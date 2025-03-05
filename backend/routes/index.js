const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Validate key and store Instagram cookies
router.post('/validatekey', async (req, res) => {
  try {
    const { key, csrftoken, ds_user_id, sessionid } = req.body;

    // Check if key exists and is valid
    const [rows] = await db.execute(
      'SELECT * FROM api_keys WHERE api_key = ? AND is_active = 1',
      [key]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    // Update cookies for the key
    await db.execute(
      `UPDATE api_keys SET 
        csrf_token = ?,
        ds_user_id = ?,
        session_id = ?,
        last_used = NOW()
      WHERE api_key = ?`,
      [csrftoken, ds_user_id, sessionid, key]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error in validatekey:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save progress
router.post('/saveprogress', async (req, res) => {
  try {
    const {
      key,
      after,
      nextAfter,
      followersCollected,
      lastFollowerAdded,
      lastFollowerId,
      username
    } = req.body;

    // Verify key exists
    const [keyCheck] = await db.execute(
      'SELECT id FROM api_keys WHERE api_key = ? AND is_active = 1',
      [key]
    );

    if (keyCheck.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Update or insert progress
    await db.execute(
      `INSERT INTO user_progress (
        api_key,
        current_after,
        next_after,
        followers_collected,
        last_follower_added,
        last_follower_id,
        last_username,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        current_after = VALUES(current_after),
        next_after = VALUES(next_after),
        followers_collected = VALUES(followers_collected),
        last_follower_added = VALUES(last_follower_added),
        last_follower_id = VALUES(last_follower_id),
        last_username = VALUES(last_username),
        updated_at = NOW()`,
      [key, after, nextAfter, followersCollected, lastFollowerAdded, lastFollowerId, username]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error in saveprogress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get progress
router.get('/saveprogress', async (req, res) => {
  try {
    const { key } = req.query;

    // Get progress for key
    const [rows] = await db.execute(
      `SELECT 
        current_after as after,
        next_after as nextAfter,
        followers_collected as followersCollected,
        last_follower_added as lastFollowerAdded,
        last_follower_id as lastFollowerId,
        last_username as username
      FROM user_progress 
      WHERE api_key = ?`,
      [key]
    );

    if (rows.length === 0) {
      return res.json(null);
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error in get progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 