import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { ThreadItem, Asset } from './ThreadItem';

const TABLE_NAME = 'thread_items_b9';
const sqlite = new SQLiteConnection(CapacitorSQLite); // <-- FIX HERE

export class Database {
  private db!: SQLiteDBConnection;
  private isInitialized: Promise<void>;

  constructor() {
    this.isInitialized = this.initDatabase();
  }

  private async initDatabase() {
    try {
      const isConn = (await sqlite.isConnection("aquawisdom_b9_db", false)).result;
      if (isConn) {
        this.db = await sqlite.retrieveConnection("aquawisdom_b9_db", false);
      } else {
        this.db = await sqlite.createConnection("aquawisdom_b9_db", false, "no-encryption", 1, false);
      }
      await this.db.open();
      await this.initTables();
    } catch (err) {
      // FIX: If isConnection returned false but it actually exists, 
      // catch the error and force retrieve the connection!
      try {
        this.db = await sqlite.retrieveConnection("aquawisdom_b9_db", false);
        await this.db.open();
        await this.initTables();
      } catch (err2) {
        console.error("Database initialization error:", err2);
      }
    }
  }

  // private async initDatabase() {
  //   try {
  //     const isConn = (await sqlite.isConnection("aquawisdom_b9", false)).result;
  //     if (isConn) {
  //       this.db = await sqlite.retrieveConnection("aquawisdom_b9", false);
  //     } else {
  //       this.db = await sqlite.createConnection("aquawisdom_b9", false, "no-encryption", 1, false);
  //     }
  //     await this.db.open();
  //     await this.initTables();
  //   } catch (err) {
  //     console.error("Database initialization error:", err);
  //     // Do not throw, so the app doesn't crash. Methods will check if this.db exists.
  //   }
  // }

  // private async initDatabase() {
  //   try {
  //     // FIX: Added 'false' (readonly) parameter for v8.x API compatibility
  //     const isConn = (await sqlite.isConnection("aquawisdom_b9", false)).result;
  //     if (isConn) {
  //       this.db = await sqlite.retrieveConnection("aquawisdom_b9", false);
  //     } else {
  //       this.db = await sqlite.createConnection("aquawisdom_b9", false, "no-encryption", 1, false);
  //     }
      
  //     await this.db.open();
  //     await this.initTables();
  //   } catch (err) {
  //     console.error("Database initialization error:", err);
  //   }
  // }

  // private async initDatabase() {
  //   this.db = await sqlite.createConnection("aquawisdom_b9", false, "no-encryption", 1, false);
  //   await this.db.open();
  //   await this.initTables();
  // }

  private async initTables() {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        device_id TEXT,
        body TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        tts_text TEXT,
        image_id TEXT,
        has_image INTEGER DEFAULT 0,
        has_assets INTEGER DEFAULT 0,
        asset_count INTEGER DEFAULT 0,
        response_type TEXT DEFAULT 'text',
        has_generated_image INTEGER DEFAULT 0,
        cloud_item_id TEXT,
        version INTEGER DEFAULT 1,
        is_synced INTEGER DEFAULT 0,
        is_shared INTEGER DEFAULT 1,
        synced_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_b9_thread_items_thread_id ON ${TABLE_NAME}(thread_id);

      CREATE TABLE IF NOT EXISTS b9_sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME
      );

      INSERT OR IGNORE INTO b9_sync_metadata (key, value, updated_at) 
      VALUES ('last_sync_time', '1970-01-01T00:00:00.000Z', CURRENT_TIMESTAMP);

      CREATE TABLE IF NOT EXISTS b9_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS b9_threads (
        id TEXT PRIMARY KEY,
        title TEXT,
        body TEXT,
        points INTEGER DEFAULT 0,
        user_name TEXT,
        category_id TEXT,
        category_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS response_assets (
        id TEXT PRIMARY KEY,
        thread_item_id TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        asset_key TEXT NOT NULL,
        remote_url TEXT,
        local_uri TEXT,
        caption TEXT,
        chart_type TEXT,
        chart_data TEXT,
        display_order INTEGER DEFAULT 0,
        cloud_asset_id TEXT,
        is_synced INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_item_id) REFERENCES ${TABLE_NAME}(id) ON DELETE CASCADE
      );
    `);
  }

  // --- THREAD ITEMS ---
  async saveThreadItem(item: ThreadItem): Promise<void> {
    await this.isInitialized;
    const sql = `
      INSERT OR REPLACE INTO ${TABLE_NAME} (
        id, thread_id, user_id, device_id, body, ai_response, tts_text, image_id,
        has_image, has_assets, asset_count, response_type, has_generated_image,
        cloud_item_id, version, is_synced, is_shared, synced_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      item.id, item.thread_id || 'default', item.user_id || 'default', item.device_id || null,
      item.body, JSON.stringify(item.ai_response || {}), item.tts_text || null, item.image_id || null,
      item.has_image || 0, item.has_assets || 0, item.asset_count || 0, item.response_type || 'text',
      item.has_generated_image || 0, item.cloud_item_id || null, item.version || 1, item.is_synced || 0,
      item.is_shared !== undefined ? item.is_shared : 1, item.synced_at || null,
      item.created_at || new Date().toISOString(), item.updated_at || new Date().toISOString()
    ];
    await this.db.run(sql, values);
  }

  async saveThreadItems(items: ThreadItem[]): Promise<void> {
  await this.isInitialized;
  if (!this.db) return;
  
  // FIX: Use execute() instead of execAsync() for @capacitor-community/sqlite
  try {
    for (const item of items) {
      await this.saveThreadItem(item);
    }
  } catch (error) {
    throw error;
  }
}
  // async saveThreadItems(items: ThreadItem[]): Promise<void> {
  //   await this.isInitialized;
  //   if (!this.db) return;
    
  //   // FIX: Use execute() instead of execAsync() for @capacitor-community/sqlite
  //   try {
  //     for (const item of items) {
  //       await this.saveThreadItem(item);
  //     }
  //   } catch (error) {
  //     throw error;
  //   }
  // }

  // async saveThreadItems(items: ThreadItem[]): Promise<void> {
  //   await this.isInitialized;
  //   for (const item of items) {
  //     await this.saveThreadItem(item);
  //   }
  // }

  // FIX 2a & 2b: Change ASC to DESC so the latest threaditems show first
  async getThreadItemsByThreadId(threadId: string): Promise<ThreadItem[]> {
    await this.isInitialized;
    if (!this.db) return [];
    const res = await this.db.query(`SELECT * FROM ${TABLE_NAME} WHERE thread_id = ? ORDER BY created_at DESC, CAST(id AS INTEGER) DESC`, [threadId]);
    return res.values ? res.values.map((row: any) => ({ ...row, ai_response: JSON.parse(row.ai_response || '{}') })) : [];
  }

  // async getThreadItemsByThreadId(threadId: string): Promise<ThreadItem[]> {
  //   await this.isInitialized;
  //   if (!this.db) return [];
  //   // FIX: Added CAST(id AS INTEGER) ASC as a fallback if created_at is identical
  //   const res = await this.db.query(`SELECT * FROM ${TABLE_NAME} WHERE thread_id = ? ORDER BY created_at ASC, CAST(id AS INTEGER) ASC`, [threadId]);
  //   return res.values ? res.values.map((row: any) => ({ ...row, ai_response: JSON.parse(row.ai_response || '{}') })) : [];
  // }

  // async getThreadItemsByThreadId(threadId: string): Promise<ThreadItem[]> {
  //   await this.isInitialized;
  //   const res = await this.db.query(`SELECT * FROM ${TABLE_NAME} WHERE thread_id = ? ORDER BY created_at ASC`, [threadId]);
  //   return res.values ? res.values.map(row => this.mapToThreadItem(row)) : [];
  // }

  async getThreadItemById(id: string): Promise<ThreadItem | null> {
    await this.isInitialized;
    const res = await this.db.query(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    return res.values && res.values.length > 0 ? this.mapToThreadItem(res.values[0]) : null;
  }

  async getUnsyncedItems(): Promise<ThreadItem[]> {
    await this.isInitialized;
    const res = await this.db.query(`SELECT * FROM ${TABLE_NAME} WHERE is_synced = 0`);
    return res.values ? res.values.map(row => this.mapToThreadItem(row)) : [];
  }

  async markItemsSynced(ids: string[]): Promise<void> {
    await this.isInitialized;
    for (const id of ids) {
      await this.db.run(`UPDATE ${TABLE_NAME} SET is_synced = 1, synced_at = ? WHERE id = ?`, [new Date().toISOString(), id]);
    }
  }

  async updateTtsText(id: string, ttsText: string): Promise<void> {
    await this.isInitialized;
    await this.db.run(`UPDATE ${TABLE_NAME} SET tts_text = ?, updated_at = ? WHERE id = ?`, [ttsText, new Date().toISOString(), id]);
  }

  // --- THREADS & CATEGORIES ---
  async getLastSyncTime(): Promise<string> {
    await this.isInitialized;
    const res = await this.db.query("SELECT value FROM b9_sync_metadata WHERE key = 'last_sync_time'");
    return res.values && res.values.length > 0 ? res.values[0].value : '1970-01-01T00:00:00.000Z';
  }

  async setLastSyncTime(timestamp: string): Promise<void> {
    await this.isInitialized;
    await this.db.run(`INSERT OR REPLACE INTO b9_sync_metadata (key, value, updated_at) VALUES ('last_sync_time', ?, ?)`, [timestamp, new Date().toISOString()]);
  }

  async saveCategories(categories: any[]): Promise<void> {
    await this.isInitialized;
    for (const cat of categories) {
      await this.db.run(`INSERT OR REPLACE INTO b9_categories (id, name) VALUES (?, ?)`, [cat.id, cat.name]);
    }
  }

  async getCategories(): Promise<any[]> {
    await this.isInitialized;
    // FIX: Sort by id ASC instead of name to match backend order
    const res = await this.db.query(`SELECT * FROM b9_categories ORDER BY CAST(id AS INTEGER) ASC`);
    return res.values ? res.values : [];
  }
  // async getCategories(): Promise<any[]> {
  //   await this.isInitialized;
  //   // FIX: Sort by id ASC instead of name
  //   const res = await this.db.query(`SELECT * FROM b9_categories ORDER BY id ASC`);
  //   return res.values ? res.values : [];
  // }
  // async getCategories(): Promise<any[]> {
  //   await this.isInitialized;
  //   const res = await this.db.query(`SELECT * FROM b9_categories ORDER BY name`);
  //   return res.values ? res.values : [];
  // }

  async saveThreads(threads: any[]): Promise<void> {
    await this.isInitialized;
    for (const th of threads) {
      await this.db.run(
        `INSERT OR REPLACE INTO b9_threads (id, title, body, points, user_name, category_id, category_name, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          th.id, th.title || '', th.body || '', th.points || 0,
          th.user?.userName || 'Unknown', th.category?.id || '0',
          th.category?.name || 'Uncategorized', th.createdOn || new Date().toISOString()
        ]
      );
    }
  }

  async getThreadById(id: string): Promise<any | null> {
    await this.isInitialized;
    const res = await this.db.query(`SELECT * FROM b9_threads WHERE id = ?`, [id]);
    return res.values && res.values.length > 0 ? res.values[0] : null;
  }

    // FIX 2c: Change LIMIT 50 to LIMIT 10 to match online behavior
  async getThreads(categoryId?: string): Promise<any[]> {
    await this.isInitialized;
    if (!this.db) return [];
    let query = `SELECT * FROM b9_threads`;
    let params: any[] = [];
    if (categoryId && categoryId !== '0' && categoryId.length > 0) {
      query += ` WHERE category_id = ?`;
      params.push(categoryId);
    }
    query += ` ORDER BY created_at DESC LIMIT 10`; // <-- CHANGE 50 to 10
    const res = await this.db.query(query, params);
    return res.values ? res.values : [];
  }
  // async getThreads(categoryId?: string): Promise<any[]> {
  //   await this.isInitialized;
  //   let query = `SELECT * FROM b9_threads`;
  //   let params: any[] = [];
  //   if (categoryId && categoryId !== '0' && categoryId.length > 0) {
  //     query += ` WHERE category_id = ?`;
  //     params.push(categoryId);
  //   }
    
  //   // FIX: Sort by ID as an integer to ensure newest threads are at the top
  //   query += ` ORDER BY CAST(id AS INTEGER) DESC LIMIT 50`;
    
  //   const res = await this.db.query(query, params);
  //   return res.values ? res.values : [];
  // }
  // async getThreads(categoryId?: string): Promise<any[]> {
  //   await this.isInitialized;
  //   let query = `SELECT * FROM b9_threads`;
  //   let params: any[] = [];
  //   if (categoryId && categoryId !== '0' && categoryId.length > 0) {
  //     query += ` WHERE category_id = ?`;
  //     params.push(categoryId);
  //   }
  //   query += ` ORDER BY created_at DESC LIMIT 50`;
  //   const res = await this.db.query(query, params);
  //   return res.values ? res.values : [];
  // }

  // --- ASSETS (Phase 4 Prep) ---
  async saveResponseAsset(asset: Asset): Promise<void> {
    await this.isInitialized;
    const sql = `
      INSERT OR REPLACE INTO response_assets (
        id, thread_item_id, asset_type, asset_key, remote_url, local_uri, 
        caption, chart_type, chart_data, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      asset.id, asset.thread_item_id, asset.asset_type, asset.id, asset.remote_url || null,
      asset.local_uri || null, asset.caption || null, asset.chart_type || null,
      asset.chart_data ? JSON.stringify(asset.chart_data) : null, asset.display_order || 0
    ];
    await this.db.run(sql, values);
  }

  async getAssetsByThreadId(threadItemId: string): Promise<Asset[]> {
    await this.isInitialized;
    const res = await this.db.query(`SELECT * FROM response_assets WHERE thread_item_id = ? ORDER BY display_order ASC`, [threadItemId]);
    if (!res.values) return [];
    
    return res.values.map((row: any) => ({
      id: row.id,
      thread_item_id: row.thread_item_id,
      asset_type: row.asset_type,
      remote_url: row.remote_url,
      local_uri: row.local_uri,
      caption: row.caption,
      chart_type: row.chart_type,
      chart_data: row.chart_data ? JSON.parse(row.chart_data) : null,
      display_order: row.display_order
    }));
  }

  // --- MAPPING HELPER ---
  private mapToThreadItem(row: any): ThreadItem {
    return {
      id: row.id,
      thread_id: row.thread_id,
      user_id: row.user_id,
      device_id: row.device_id,
      body: row.body,
      ai_response: JSON.parse(row.ai_response || '{}'),
      tts_text: row.tts_text,
      image_id: row.image_id,
      has_image: row.has_image,
      has_assets: row.has_assets,
      asset_count: row.asset_count,
      response_type: row.response_type,
      has_generated_image: row.has_generated_image,
      cloud_item_id: row.cloud_item_id,
      version: row.version,
      is_synced: row.is_synced,
      is_shared: row.is_shared,
      synced_at: row.synced_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const database = new Database();

(window as any).db = database;