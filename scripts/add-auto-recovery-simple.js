#!/usr/bin/env node

import { db } from '../lib/db-supabase.js';

async function addAutoRecoveryColumn() {
  try {
    console.log('🚀 Adding auto_recovery column to services table...');

    // Try to add the column by using a direct query
    const { error } = await db.client.rpc('exec', {
      sql: 'ALTER TABLE services ADD COLUMN IF NOT EXISTS auto_recovery BOOLEAN DEFAULT true;',
    });

    if (error) {
      console.error('❌ Error adding column:', error);
      // Let's try a different approach - just verify the column exists
      console.log('Trying alternative approach...');

      // Test if we can add a test service with auto_recovery
      const testService = {
        status_page_id: '960376cf-dd26-4f99-8ed7-f8d31cbfe8f7',
        name: 'Test Auto Recovery',
        description: 'Testing auto recovery field',
        status: 'operational',
        auto_recovery: true,
      };

      const { data, error: createError } = await db.client
        .from('services')
        .insert(testService)
        .select()
        .single();

      if (createError) {
        console.error('❌ Auto recovery column still missing:', createError);
        console.log(
          'Manual SQL needed: ALTER TABLE services ADD COLUMN auto_recovery BOOLEAN DEFAULT true;'
        );
      } else {
        console.log('✅ Auto recovery column already exists!');
        // Clean up test service
        await db.client.from('services').delete().eq('id', data.id);
      }
    } else {
      console.log('✅ Successfully added auto_recovery column');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addAutoRecoveryColumn();
