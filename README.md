# Journal

A calm, Day One–inspired journaling web app built with plain HTML, CSS, and JavaScript.

## Features
- Supabase Authentication (Sign in, Sign up, Password reset, and Account menu)
- Secure credential management (Supabase URL and Key in `.gitignore`)
- Timeline journal
- Rich text editor
- Browser persistence with IndexedDB
- Photos stored locally in the browser
- Journals: Personal, Work, Travel
- Search
- Calendar
- Favorites
- Photo gallery
- Dark mode
- JSON export
- Responsive layout

## Supabase Authentication Setup

1. **Create or copy configuration:**
   Copy `config.example.js` to `config.js`:
   ```bash
   cp config.example.js config.js
   ```

2. **Add your Supabase credentials:**
   In `config.js`, set your Supabase Project URL and Anon Public Key:
   ```javascript
   window.SUPABASE_CONFIG = {
     url: "https://your-project-id.supabase.co",
     anonKey: "your-anon-public-key-here"
   };
   ```

3. **Git Protection:**
   `config.js` is automatically excluded by `.gitignore`, ensuring your secret keys are never committed or pushed to your repository.

*(Alternatively, you can click "⚙ Keys" inside the in-app Sign In dialog to save credentials directly in your browser).*

## Run

Because IndexedDB and some browser features work best from a local server, run:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000
