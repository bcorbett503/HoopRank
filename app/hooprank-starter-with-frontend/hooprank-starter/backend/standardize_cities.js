/**
 * Standardize city names to "City, ST" format
 */
const { Client } = require('pg');

const CITY_MAPPINGS = {
    // Major cities without state abbreviation
    'Chicago': 'Chicago, IL',
    'Los Angeles': 'Los Angeles, CA',
    'Houston': 'Houston, TX',
    'Philadelphia': 'Philadelphia, PA',
    'San Francisco': 'San Francisco, CA',
    'Dallas': 'Dallas, TX',
    'Charlotte': 'Charlotte, NC',
    'San Antonio': 'San Antonio, TX',
    'Phoenix': 'Phoenix, AZ',
    'San Diego': 'San Diego, CA',
    'Austin': 'Austin, TX',
    'Boston': 'Boston, MA',
    'Fort Worth': 'Fort Worth, TX',
    'Portland': 'Portland, OR',
    'Nashville': 'Nashville, TN',
    'Louisville': 'Louisville, KY',
    'Oklahoma City': 'Oklahoma City, OK',
    'Las Vegas': 'Las Vegas, NV',
    'Seattle': 'Seattle, WA',
    'Denver': 'Denver, CO',
    'Washington': 'Washington, DC',
    'Detroit': 'Detroit, MI',
    'Columbus': 'Columbus, OH',
    'Jacksonville': 'Jacksonville, FL',
    'Indianapolis': 'Indianapolis, IN',
    'San Jose': 'San Jose, CA',
    'Tucson': 'Tucson, AZ',
    'Fresno': 'Fresno, CA',
    'Sacramento': 'Sacramento, CA',
    'Albuquerque': 'Albuquerque, NM',
    'Omaha': 'Omaha, NE',
    'Kansas City': 'Kansas City, MO',
    'Atlanta': 'Atlanta, GA',
    'Memphis': 'Memphis, TN',
    'Baltimore': 'Baltimore, MD',
    'Milwaukee': 'Milwaukee, WI',

    // NYC boroughs -> New York, NY
    'Manhattan': 'New York, NY',
    'Brooklyn': 'Brooklyn, NY',
    'Queens': 'Queens, NY',
    'Bronx': 'Bronx, NY',
    'Staten Island': 'Staten Island, NY',

    // Suburbs
    'Northridge': 'Northridge, CA',
    'Hollywood': 'Los Angeles, CA',
    'North Hollywood': 'Los Angeles, CA',
    'Reseda': 'Los Angeles, CA',
    'Van Nuys': 'Los Angeles, CA',
    'Montebello': 'Montebello, CA',
    'Gardena': 'Gardena, CA',
    'Torrance': 'Torrance, CA',
    'Culver City': 'Culver City, CA',
    'Monrovia': 'Monrovia, CA',
    'La Crescenta': 'La Crescenta, CA',
    'Sierra Madre': 'Sierra Madre, CA',
    'San Pedro': 'San Pedro, CA',
    'Westchester': 'Los Angeles, CA',
    'Calabasas': 'Calabasas, CA',
    'Beaverton': 'Beaverton, OR',
    'Milwaukie': 'Milwaukie, OR',
    'Tigard': 'Tigard, OR',
    'Lake Oswego': 'Lake Oswego, OR',
    'Oregon City': 'Oregon City, OR',
    'Clackamas': 'Clackamas, OR',
    'Bethany': 'Bethany, OR',
    'Bellevue': 'Bellevue, WA',
    'Shoreline': 'Shoreline, WA',
    'Auburn': 'Auburn, WA',
    'La Jolla': 'La Jolla, CA',
    'Chula Vista': 'Chula Vista, CA',
    'Encinitas': 'Encinitas, CA',
    'Escondido': 'Escondido, CA',
    'Oceanside': 'Oceanside, CA',
    'La Mesa': 'La Mesa, CA',
    'Santee': 'Santee, CA',
    'Cupertino': 'Cupertino, CA',
    'Mesa': 'Mesa, AZ',
    'Aurora': 'Aurora, CO',
    'Arvada': 'Arvada, CO',
    'Littleton': 'Littleton, CO',
    'Brighton': 'Brighton, CO',
    'Monument': 'Monument, CO',
    'Fountain': 'Fountain, CO',
    'Colorado Springs': 'Colorado Springs, CO',
    'Marietta': 'Marietta, GA',
    'Alpharetta': 'Alpharetta, GA',
    'Lawrenceville': 'Lawrenceville, GA',
    'Hyde Park': 'Chicago, IL',
    'Maywood': 'Maywood, IL',
    'Bartlett': 'Bartlett, IL',
    'Waltham': 'Waltham, MA',
    'Royal Oak': 'Royal Oak, MI',
    'Fishers': 'Fishers, IN',
    'Franklin': 'Franklin, TN',
    'Collierville': 'Collierville, TN',
    'Cordova': 'Cordova, TN',
    'Gretna': 'Gretna, LA',
    'Midwest City': 'Midwest City, OK',
    'North Las Vegas': 'North Las Vegas, NV',
    'Bethesda': 'Bethesda, MD',
    'Delaware': 'Delaware, OH',
    'Reynoldsburg': 'Reynoldsburg, OH',
    'Grove City': 'Grove City, OH',
    'Birmingham': 'Birmingham, AL',
    'Brown Deer': 'Brown Deer, WI',
    'Milford': 'Milford, OH',
    'Matthews': 'Matthews, NC',
    'Schertz': 'Schertz, TX',
    'League City': 'League City, TX',
    'Buda': 'Buda, TX',
    'Dripping Springs': 'Dripping Springs, TX',
    'Arlington': 'Arlington, TX',
    'Papillion': 'Papillion, NE',
    'North Kansas City': 'North Kansas City, MO',
    'Southgate': 'Southgate, MI',
    'Wilmington': 'Wilmington, DE',
    'Reedley': 'Reedley, CA',
    'Sanger': 'Sanger, CA',
};

async function standardizeCities() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== STANDARDIZING CITY NAMES ===\n');

        let updated = 0;

        for (const [oldName, newName] of Object.entries(CITY_MAPPINGS)) {
            const result = await client.query(`
        UPDATE courts 
        SET city = $2 
        WHERE city = $1
        RETURNING id
      `, [oldName, newName]);

            if (result.rowCount > 0) {
                console.log(`✅ ${oldName} → ${newName} (${result.rowCount} courts)`);
                updated += result.rowCount;
            }
        }

        console.log(`\n=== RESULTS ===`);
        console.log(`✅ Updated: ${updated} courts`);

        // Show new city counts
        const cityCount = await client.query('SELECT COUNT(DISTINCT city) as count FROM courts');
        console.log(`📍 Total unique cities now: ${cityCount.rows[0].count}`);

        // Show top cities after update
        const top = await client.query(`
      SELECT city, COUNT(*) as count 
      FROM courts 
      WHERE city IS NOT NULL 
      GROUP BY city 
      ORDER BY COUNT(*) DESC 
      LIMIT 15
    `);
        console.log('\nTop 15 cities after standardization:');
        top.rows.forEach(r => console.log(`  ${r.city}: ${r.count}`));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

standardizeCities();
