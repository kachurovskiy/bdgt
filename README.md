# BDGT

BDGT is a local-first budgeting dashboard for importing transaction CSV files,
categorizing spending, reviewing recurring costs, and tracking net worth in the
browser.

## Features

- Import and merge bank transaction CSV files.
- Enrich Amazon-looking transactions with Amazon order history CSV data.
- Manage expense and income categorization rules.
- Review proposed rules, manual overrides, high-value exclusions, and
  recurring streams.
- Track monthly category trends, projects, net worth, and retirement scenarios.
- Load demo data to explore the app without importing personal files.

## Privacy Model

BDGT has no backend. Imported transactions and settings are stored in browser
`localStorage` under keys starting with `bdgt.`.

- **Backup** downloads a JSON snapshot of the app's `bdgt.*` local data.
- **Restore** replaces the app's `bdgt.*` local data with a backup file.
- **Clear Local Data** removes the app's `bdgt.*` local data only.
- **Database Overview** shows the app-owned `bdgt.*` localStorage stores and
  their sizes.

Backup files can contain sensitive financial data. Keep them private and do not
commit them to git.

## Getting Started

Open `index.html` in a browser. No build step is required.

The app uses CDN-hosted Bootstrap and Chart.js assets, so charts and styling
expect network access unless those assets are cached by the browser.

## Development

Install dependencies:

```sh
npm install
```

Run the UI test suite:

```sh
npm run test:ui
```

## Import Notes

The transaction importer supports CSV files with common banking-style columns,
including the demo fixture shape:

```csv
Transaktionstyp;Buchungsdatum;Betrag;Verwendungszweck;Beschreibung;Kategorie
Card;02.01.2025;-19,99;Netflix streaming;Monthly netflix subscription;
```

Comdirect-style CSV exports are also covered by the test fixtures.

## License

MIT. See [LICENSE](LICENSE).
