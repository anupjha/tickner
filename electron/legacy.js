'use strict';
// One-time import of data from when the app was called "Tasks" (and its database was tasks.db).
// Runs only if tickner.db does not exist yet. The old files are copied, never moved or deleted.
const fs = require('fs');
const path = require('path');

function migrateLegacyData({ userData, appData }) {
  const result = { migrated: false, from: null, localStorage: false };
  const target = path.join(userData, 'tickner.db');
  if (fs.existsSync(target)) return result;
  fs.mkdirSync(userData, { recursive: true });

  // the old database: renamed in place, or inside the old app's data folder (e.g. ~/Library/Application Support/Tasks)
  const found = [path.join(userData, 'tasks.db'), path.join(appData, 'Tasks', 'tasks.db')].find(f => fs.existsSync(f));
  if (found) {
    // copy the write-ahead log too, so the most recent changes come along
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(found + suffix)) fs.copyFileSync(found + suffix, target + suffix);
    result.migrated = true; result.from = found;
  }

  // the oldest versions kept data in the page's local storage; carry that folder over so it can still be imported
  const oldLocal = path.join(appData, 'Tasks', 'Local Storage'), newLocal = path.join(userData, 'Local Storage');
  if (fs.existsSync(oldLocal) && !fs.existsSync(newLocal)) { fs.cpSync(oldLocal, newLocal, { recursive: true }); result.localStorage = true; }
  return result;
}

module.exports = { migrateLegacyData };
