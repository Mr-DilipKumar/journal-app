# Journal — Premium Journaling App

A calm, Day One–inspired personal journaling web app built with HTML5, CSS3, and modern JavaScript.

## Features
- **Supabase Cloud Sync & Authentication**: Instant sign-in, remembered credentials, auto-login, and profile manager
- **Day One Reflections**: Mood tracking (Joyful, Calm, Neutral, Sad, Challenging), weather & location tagging, 30+ daily reflection prompts
- **Voice Memo Recording**: Built-in voice recorder with live timer, audio playback, and persistence
- **Rich Text & Checklists**: Interactive markdown-style checkboxes, color highlighters, blockquotes, word & reading time counter
- **Zen Focus Mode**: Distraction-free full-screen writing canvas with ambient soundscapes
- **4 Crafted Aesthetics**: Paper (clean minimalist warm cream), Midnight (deep OLED dark mode), Sage (organic olive & pine), Twilight (nordic dusk)
- **PIN Privacy Lock**: 4-digit security code with auto-lock protection
- **On This Day & Insights**: Relive memories from past years, view mood distributions, and track journaling streaks
- **Local Persistence & Offline Ready**: Fast IndexedDB storage with instant loading

## Configuration

Your Supabase project settings are stored directly in `config.js`:

```javascript
window.SUPABASE_CONFIG = {
  url: "https://uhpojlnkpliknifhlrft.supabase.co",
  anonKey: "sb_publishable_JylRGEVBzr8J0urSzQIeBA_NubZ-n68"
};
```

## Running Locally

To start the local preview server:

```bash
python -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000) in your browser.

