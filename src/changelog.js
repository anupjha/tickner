// Release notes shown in the notification center after an update. Newest first.
// To ship a release: add an entry here, bump "version" in package.json, build. People who already use the app
// get a "What's new in <version>" notification the next time they open it.
export const CHANGELOG = [
  {
    version: '1.1.0',
    date: '2026-11-14',
    title: 'Notifications',
    highlights: [
      'A bell in the header collects “what’s new” notes after each update.',
      'The desktop app can check for new versions and tell you when one is available.',
      'Choose what you hear about: new features, update checks and system alerts.'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-11-14',
    title: 'Welcome to Tickner',
    highlights: [
      'Tasks with due dates, tags and repeating schedules.',
      'A daily plan, bookmarks, a scratch pad and an encrypted vault.',
      'Export and import everything as one JSON file.'
    ]
  }
];
