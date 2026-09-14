export interface ThreadItem {
 id: string;
 thread_id?: string;
 user_id?: string;
 device_id?: string;
 body: string;
 ai_response: any;
 tts_text?: string;
 image_id?: string;
 has_image?: number;
 has_assets?: number;
 asset_count?: number;
 response_type?: string;
 has_generated_image?: number;
 cloud_item_id?: string;
 version?: number;
 is_synced?: number;
 is_shared?: number;
 synced_at?: string;
 created_at?: string;
 updated_at?: string;
}


export interface Asset {
 id: string;
 thread_item_id: string;
 asset_type: 'image' | 'chart' | 'diagram' | 'map';
 remote_url?: string;
 local_uri?: string;
 caption?: string;
 chart_type?: 'bar' | 'line' | 'pie' | 'scatter';
 chart_data?: any;
 display_order?: number;
}
