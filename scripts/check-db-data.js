/**
 * Quick check database content
 */
import 'dotenv/config';
import SQLiteClient from '../src/storage/sqlite-client.js';

async function checkData() {
  const client = new SQLiteClient();
  
  try {
    await client.connect();
    
    // Check total records
    const total = await client.query('SELECT COUNT(*) as count FROM sap_fi_data');
    console.log(`\n📊 Total records: ${total[0].count}`);
    
    if (total[0].count > 0) {
      // Check years
      const years = await client.query(`
        SELECT fiscal_year, COUNT(*) as count 
        FROM sap_fi_data 
        GROUP BY fiscal_year 
        ORDER BY fiscal_year
      `);
      
      console.log('\n📅 Records per year:');
      years.forEach(y => console.log(`   ${y.fiscal_year}: ${y.count} records`));
      
      // Latest extraction
      const latest = await client.query(`
        SELECT extraction_date, job_id, COUNT(*) as count
        FROM sap_fi_data 
        GROUP BY extraction_date, job_id
        ORDER BY extraction_date DESC
        LIMIT 5
      `);
      
      console.log('\n🔄 Latest extractions:');
      latest.forEach(e => console.log(`   ${e.extraction_date} - ${e.job_id}: ${e.count} records`));
    }
    
    await client.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkData();
