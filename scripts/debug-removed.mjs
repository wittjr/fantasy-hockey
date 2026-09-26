import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const removed = await sql`select * from removed_player`;
console.log('removed_player rows:', removed);

const targetPlayerId = removed[0].fantrax_player_id;

// Fetch live Fantrax pool to see what this player actually is
const poolRes = await fetch('https://www.fantrax.com/fxea/general/getPlayerIds?sport=NHL');
const pool = await poolRes.json();
console.log('\nTarget player from live pool:', targetPlayerId, '->', pool[targetPlayerId]);

// Fetch this user's spreadsheet projections
const userLeagues = await sql`select user_id from user_league where id = 'afeae540-074b-4c08-8ef5-79e8ad15cf43'`;
const userId = userLeagues[0].user_id;
const projections = await sql`select id, name, position, nhl_team_abbrev from spreadsheet_projection where user_id = ${userId}`;
console.log('\nTotal projections:', projections.length);

// Replicate normalizeName + fantraxNameToFirstLast logic
function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !['jr', 'sr', 'ii', 'iii', 'iv'].includes(w))
    .join(' ');
}
function fantraxNameToFirstLast(fantraxName) {
  const [last, first] = fantraxName.split(',').map((s) => s.trim());
  return first && last ? `${first} ${last}` : fantraxName;
}

const targetPlayer = pool[targetPlayerId];
const targetNormalized = targetPlayer ? normalizeName(fantraxNameToFirstLast(targetPlayer.name)) : null;
console.log('\nTarget normalized name:', targetNormalized);

const matchingProjectionRows = projections.filter((p) => normalizeName(p.name) === targetNormalized);
console.log('Projection rows with matching normalized name:', matchingProjectionRows);
