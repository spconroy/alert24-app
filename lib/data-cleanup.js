import { SupabaseClient } from './db-supabase.js';

const db = new SupabaseClient();

/**
 * Clean up incidents that have service objects in affected_services field
 * Convert service objects to service names/IDs
 */
export async function cleanupIncidentAffectedServices() {
  try {
    console.log('🧹 Starting cleanup of incident affected_services...');
    
    // Get all incidents
    const { data: incidents, error: fetchError } = await db.client
      .from('incidents')
      .select('id, affected_services')
      .not('affected_services', 'is', null);
    
    if (fetchError) {
      console.error('❌ Error fetching incidents:', fetchError);
      throw fetchError;
    }
    
    if (!incidents || incidents.length === 0) {
      console.log('✅ No incidents found, cleanup complete');
      return { fixed: 0, total: 0 };
    }
    
    console.log(`📊 Found ${incidents.length} incidents to check`);
    
    let fixedCount = 0;
    const batchSize = 10;
    
    // Process incidents in batches
    for (let i = 0; i < incidents.length; i += batchSize) {
      const batch = incidents.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(incidents.length / batchSize)}`);
      
      for (const incident of batch) {
        if (!incident.affected_services || !Array.isArray(incident.affected_services)) {
          continue;
        }
        
        // Check if any items in affected_services are objects
        const hasObjects = incident.affected_services.some(service => 
          typeof service === 'object' && service !== null
        );
        
        if (hasObjects) {
          console.log(`🔧 Fixing incident ${incident.id} with object services`);
          
          // Convert objects to strings
          const cleanedServices = incident.affected_services.map(service => {
            if (typeof service === 'string') {
              return service;
            }
            if (typeof service === 'object' && service !== null) {
              return service.name || service.id || 'Unknown Service';
            }
            return 'Unknown Service';
          });
          
          // Update the incident
          const { error: updateError } = await db.client
            .from('incidents')
            .update({ affected_services: cleanedServices })
            .eq('id', incident.id);
          
          if (updateError) {
            console.error(`❌ Error updating incident ${incident.id}:`, updateError);
          } else {
            console.log(`✅ Fixed incident ${incident.id}`);
            fixedCount++;
          }
        }
      }
      
      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < incidents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`🎉 Cleanup complete! Fixed ${fixedCount} out of ${incidents.length} incidents`);
    return { fixed: fixedCount, total: incidents.length };
    
  } catch (error) {
    console.error('💥 Error during cleanup:', error);
    throw error;
  }
}

/**
 * Verify that all incidents have clean affected_services data
 */
export async function verifyIncidentDataCleanup() {
  try {
    console.log('🔍 Verifying incident data cleanup...');
    
    const { data: incidents, error } = await db.client
      .from('incidents')
      .select('id, affected_services')
      .not('affected_services', 'is', null);
    
    if (error) {
      console.error('❌ Error fetching incidents for verification:', error);
      throw error;
    }
    
    let issuesFound = 0;
    
    for (const incident of incidents || []) {
      if (!incident.affected_services || !Array.isArray(incident.affected_services)) {
        continue;
      }
      
      const hasObjects = incident.affected_services.some(service => 
        typeof service === 'object' && service !== null
      );
      
      if (hasObjects) {
        console.log(`⚠️ Found incident ${incident.id} still has object services:`, incident.affected_services);
        issuesFound++;
      }
    }
    
    if (issuesFound === 0) {
      console.log('✅ Verification passed! All incidents have clean affected_services data');
    } else {
      console.log(`❌ Verification failed! Found ${issuesFound} incidents with object services`);
    }
    
    return { issuesFound, total: incidents?.length || 0 };
    
  } catch (error) {
    console.error('💥 Error during verification:', error);
    throw error;
  }
}

/**
 * Run both cleanup and verification
 */
export async function runDataCleanup() {
  try {
    const cleanupResult = await cleanupIncidentAffectedServices();
    const verificationResult = await verifyIncidentDataCleanup();
    
    return {
      cleanup: cleanupResult,
      verification: verificationResult
    };
  } catch (error) {
    console.error('💥 Data cleanup failed:', error);
    throw error;
  }
}