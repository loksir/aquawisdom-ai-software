import { Router } from 'express';
import { AppDataSource_Joint_UT_SQL_CAP_S1_B7 } from '../index.js';
import { ThreadItem } from '../repo/ThreadItem.js';

const router = Router();

// PULL: Return items since timestamp
router.post('/api/sync', async (req, res) => {
  try {
    const { since } = req.body;
    const sinceDate = since ? new Date(since) : new Date(0);
    const items = await AppDataSource_Joint_UT_SQL_CAP_S1_B7.getRepository(ThreadItem)
      .createQueryBuilder('ti')
      .leftJoinAndSelect('ti.thread', 'thread')
      .leftJoinAndSelect('ti.user', 'user')
      .where('ti.createdOn > :since', { since: sinceDate })
      .orderBy('ti.createdOn', 'ASC')
      .getMany();
      
    return res.json({ success: true, items, lastSync: new Date().toISOString(), count: items.length });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// PULL: Return items since timestamp
router.post('/api/sync', async (req, res) => {
  try {
    const { since } = req.body;
    
    // FIX: Limit initial bulk sync to the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // If 'since' is older than 7 days ago (or empty), use 7 days ago instead
    let sinceDate = since ? new Date(since) : new Date(0);
    if (sinceDate < sevenDaysAgo) {
      sinceDate = sevenDaysAgo;
    }

    const items = await AppDataSource_Joint_UT_SQL_CAP_S1_B7.getRepository(ThreadItem)
      .createQueryBuilder('ti')
      .leftJoinAndSelect('ti.thread', 'thread')
      .leftJoinAndSelect('ti.user', 'user')
      .where('ti.createdOn > :since', { since: sinceDate })
      .orderBy('ti.createdOn', 'ASC')
      .getMany();
      
    return res.json({ success: true, items, lastSync: new Date().toISOString(), count: items.length });
  } catch (error) { 
    return res.status(500).json({ success: false, error: (error as Error).message }); 
  }
});
// PUSH: Receive locally created Cloud items
// router.post('/api/sync/push', async (req, res) => {
//   try {
//     const { items } = req.body;
//     const repo = AppDataSource_Joint_UT_SQL_CAP_S1_B7.getRepository(ThreadItem);
//     const userRepo = AppDataSource_Joint_UT_SQL_CAP_S1_B7.getRepository(User);

//     for (const item of items) {
//       const exists = await repo.findOne({ where: { id: parseInt(item.id) } });
//       if (exists) continue; // Skip if already pushed

//       // Safely parse user_id, fallback to admin (ID 1) if local_guest
//       let finalUserId = parseInt(item.user_id);
//       if (item.user_id === 'local_guest' || isNaN(finalUserId)) {
//         const defaultUser = await userRepo.findOne({ where: { userName: "admin" } });
//         finalUserId = defaultUser ? defaultUser.id : 1; 
//       }

//       await repo.save({
//         id: parseInt(item.id),
//         body: item.body,
//         aiResponse: item.ai_response?.text || '',
//         tts_text: item.tts_text || '',
//         thread: { id: parseInt(item.thread_id) },
//         user: { id: finalUserId },
//         createdOn: new Date(item.created_at),
//         lastModifiedOn: new Date(),
//       });
//     }
    
//     return res.json({ success: true, count: items.length });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: (error as Error).message });
//   }
// });

// GET: TTS Fallback
router.get('/api/thread-item/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await AppDataSource_Joint_UT_SQL_CAP_S1_B7.getRepository(ThreadItem).findOne({ where: { id: parseInt(id) } });
    
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    
    return res.json({ success: true, item: { id: item.id, tts_text: item.tts_text || '', body: item.body, aiResponse: item.aiResponse } });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;