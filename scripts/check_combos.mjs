const base = 'http://127.0.0.1:3000';

async function getFetch() {
  if (typeof fetch !== 'undefined') return fetch;
  try {
    const mod = await import('node-fetch');
    return mod.default || mod;
  } catch (e) {
    throw new Error('fetch is not available and node-fetch could not be imported');
  }
}

async function check() {
  const fetch = await getFetch();
  for (let g = 1; g <= 16; g++) {
    try {
      const res = await fetch(`${base}/api/tables/suggest-combos?guests=${g}`);
      const data = await res.json();
      console.log(`\nGuests: ${g}`);
      if (data.combos && data.combos.length > 0) {
        data.combos.forEach((c, i) => {
          const label = c.tables.map(t => `${t.table_number}(${t.capacity})`).join(' + ');
          console.log(`  Option ${i+1}: ${label} — total ${c.total}`);
        });
      } else {
        console.log('  No suggested combos — availableTables count:', (data.availableTables||[]).length);
      }
    } catch (e) {
      console.error('Error fetching combos for', g, e);
    }
  }
}

check().catch(e=>console.error(e));
