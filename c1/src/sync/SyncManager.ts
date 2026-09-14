import { database } from '../db/Database';
import { isOnHomeWiFi } from '../utils/network';

// FIX: Change to HTTPS port 8503 to avoid Mixed Content blocks
const C1_MINI_PC_URL = 'https://192.168.0.151:8503';

export class SyncManager {
  private isSyncing: boolean = false;

  async backgroundSync(): Promise<void> {
    if (!await isOnHomeWiFi() || this.isSyncing) return;
    await this.syncAll();
  }

  async syncAll(): Promise<void> {
    this.isSyncing = true;
    try {
      const lastSync = await database.getLastSyncTime();
      const pullRes = await fetch(`${C1_MINI_PC_URL}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since: lastSync })
      });
      
      if (pullRes.ok) {
        const pullData = await pullRes.json();
        if (pullData.items?.length > 0) {
          const threadsToSave: any[] = [];
          const items = pullData.items.map((item: any) => {
            // FIX: Extract and cache the Thread data!
            if (item.thread) {
              threadsToSave.push({
                id: item.thread.id.toString(),
                title: item.thread.title || '',
                body: item.thread.body || '',
                points: item.thread.points || 0,
                user: { userName: item.thread.user?.userName || 'Unknown' },
                category: { id: item.thread.category?.id || '0', name: item.thread.category?.name || 'Uncategorized' },
                createdOn: item.thread.createdOn || new Date().toISOString()
              });
            }
            return {
              id: item.id.toString(),
              thread_id: item.thread?.id?.toString() || 'default',
              user_id: item.user?.id?.toString() || 'default',
              body: item.body || '',
              ai_response: { text: item.aiResponse || '' },
              tts_text: item.tts_text || '',
              created_at: item.createdOn || new Date().toISOString(),
              is_synced: 1
            };
          });
          
          // Save threads first, then items
          if (threadsToSave.length > 0) await database.saveThreads(threadsToSave);
          await database.saveThreadItems(items);
          await database.setLastSyncTime(pullData.lastSync);
        }
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncManager = new SyncManager();

// import { database } from '../db/Database';
// import { isOnHomeWiFi } from '../utils/network';

// const C1_MINI_PC_URL = 'http://192.168.0.151:5100';

// export class SyncManager {
//   private isSyncing: boolean = false;

//   async backgroundSync(): Promise<void> {
//     if (!await isOnHomeWiFi() || this.isSyncing) return;
//     await this.syncAll();
//   }

//   async syncAll(): Promise<void> {
//     this.isSyncing = true;
//     try {
//       // 1. PULL new items from Mini PC
//       const lastSync = await database.getLastSyncTime();
//       const pullRes = await fetch(`${C1_MINI_PC_URL}/api/sync`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ since: lastSync })
//       });
      
//       if (pullRes.ok) {
//         const pullData = await pullRes.json();
//         if (pullData.items?.length > 0) {
//           const threadsToSave: any[] = []; // <--- FIX HERE
//           const items = pullData.items.map((item: any) => {
//             if (item.thread) {
//               threadsToSave.push({
//                 id: item.thread.id.toString(), title: item.thread.title || '',
//                 body: item.thread.body || '', points: item.thread.points || 0,
//                 user: { userName: item.thread.user?.userName || 'Unknown' },
//                 category: { id: item.thread.category?.id || '0', name: item.thread.category?.name || 'Uncategorized' },
//                 createdOn: item.thread.createdOn || new Date().toISOString()
//               });
//             }
//             return {
//               id: item.id.toString(), thread_id: item.thread?.id?.toString() || 'default',
//               user_id: item.user?.id?.toString() || 'default', body: item.body || '',
//               ai_response: { text: item.aiResponse || '' }, tts_text: item.tts_text || '',
//               created_at: item.createdOn || new Date().toISOString(), is_synced: 1
//             };
//           });
//           if (threadsToSave.length > 0) await database.saveThreads(threadsToSave);
//           await database.saveThreadItems(items);
//           await database.setLastSyncTime(pullData.lastSync);
//         }
//       }

//       // 2. PUSH locally created Cloud items to Mini PC
//       const unsyncedItems = await database.getUnsyncedItems();
//       if (unsyncedItems.length > 0) {
//         const pushRes = await fetch(`${C1_MINI_PC_URL}/api/sync/push`, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ items: unsyncedItems })
//         });
        
//         if (pushRes.ok) {
//           await database.markItemsSynced(unsyncedItems.map(i => i.id));
//         }
//       }
//     } catch (error) {
//       console.error('❌ Sync error:', error);
//     } finally {
//       this.isSyncing = false;
//     }
//   }

//   getSyncStatus(): boolean {
//     return this.isSyncing;
//   }
// }

// export const syncManager = new SyncManager();
